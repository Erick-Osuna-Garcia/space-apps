"""Capas de estado de la superficie: retrodispersión GCOV, cambios, agua, humedad SME2 y disturbios."""

from __future__ import annotations

import hashlib
import logging
import re
import warnings
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import h5py
import numpy as np
from pyproj import Transformer
from shapely.geometry import box, shape

from .config import RegionConfig, StackConfig
from .download import Opener, earthdata_opener, require_credentials
from .grid import Grid
from .gunw import resample

log = logging.getLogger(__name__)

GCOV = "/science/LSAR/GCOV/grids/frequencyA"
SME2 = "/science/LSAR/SME2/grids"
SME2_FILL = -9999.0
DECIMATE = 8  # GCOV viene a 10 m; se promedia en potencia a 80 m antes de guardar

CHANGE_DB = 3.0
WATER_DB = -14.0
WATER_DROP_DB = 5.0
WATER_MAX_SLOPE_DEG = 10.0
COHERENCE_DROP = 0.3

_DATE = re.compile(r"_(\d{8})T\d{6}")


@dataclass(frozen=True)
class Scene:
    id: str
    url: str
    date: str
    coverage: float


def _asf(**kwargs) -> list:
    import asf_search as asf

    return list(asf.search(dataset=asf.DATASET.NISAR, maxResults=500, **kwargs))


def monthly_scenes(
    region: RegionConfig,
    product: str,
    stack: StackConfig,
    search_fn: Callable[..., list] = _asf,
) -> list[Scene]:
    """Una escena por mes del mismo stack: la de mayor cobertura de la región."""
    area = box(*region.bbox)
    start, end = region.date_range
    results = search_fn(
        processingLevel=product,
        intersectsWith=area.wkt,
        relativeOrbit=stack.relative_orbit,
        start=f"{start.isoformat()}T00:00:00Z",
        end=f"{end.isoformat()}T23:59:59Z",
    )
    best: dict[str, Scene] = {}
    for r in results:
        pr = r.properties
        if int(pr["frameNumber"]) != stack.frame:
            continue
        found = _DATE.search(pr["sceneName"])
        if not found:
            continue
        d = found.group(1)
        iso = f"{d[:4]}-{d[4:6]}-{d[6:]}"
        scene = Scene(
            id=pr["sceneName"],
            url=pr["url"],
            date=iso,
            coverage=round(shape(r.geometry).intersection(area).area / area.area, 3),
        )
        month = iso[:7]
        if month not in best or scene.coverage > best[month].coverage:
            best[month] = scene
    return [best[m] for m in sorted(best)]


def block_mean(arr: np.ndarray, n: int) -> np.ndarray:
    """Promedio por bloques n×n ignorando NaN; recorta el borde que no completa un bloque."""
    h, w = (arr.shape[0] // n) * n, (arr.shape[1] // n) * n
    blocks = arr[:h, :w].reshape(h // n, n, w // n, n)
    valid = np.isfinite(blocks)
    count = valid.sum(axis=(1, 3))
    total = np.where(valid, blocks, 0).sum(axis=(1, 3), dtype=np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        return (total / count).astype(np.float32)


def to_db(power: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        out = 10 * np.log10(power)
    out[~np.isfinite(out)] = np.nan
    return out.astype(np.float32)


def _window(grid: Grid, epsg: int, x: np.ndarray, y: np.ndarray):
    min_x, min_y, max_x, max_y = grid.bounds
    if f"EPSG:{epsg}" != grid.crs:
        tr = Transformer.from_crs(grid.crs, f"EPSG:{epsg}", always_xy=True)
        min_x, min_y, max_x, max_y = tr.transform_bounds(min_x, min_y, max_x, max_y)
    cols = np.nonzero((x >= min_x) & (x <= max_x))[0]
    rows = np.nonzero((y >= min_y) & (y <= max_y))[0]
    if cols.size < 2 or rows.size < 2:
        raise ValueError("El producto no cubre la grilla de la región")
    return slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)


def read_gcov(f: h5py.File, grid: Grid) -> dict:
    """Recorte de HH y HV en potencia, promediado a 80 m."""
    x = f[f"{GCOV}/xCoordinates"][()]
    y = f[f"{GCOV}/yCoordinates"][()]
    epsg = int(f[f"{GCOV}/projection"][()])
    rows, cols = _window(grid, epsg, x, y)
    n = DECIMATE
    hh = block_mean(np.asarray(f[f"{GCOV}/HHHH"][rows, cols], dtype=np.float32), n)
    hv = block_mean(np.asarray(f[f"{GCOV}/HVHV"][rows, cols], dtype=np.float32), n)
    xs = x[cols][: hh.shape[1] * n].reshape(-1, n).mean(axis=1)
    ys = y[rows][: hh.shape[0] * n].reshape(-1, n).mean(axis=1)
    return {"hh": hh, "hv": hv, "x": xs, "y": ys, "epsg": epsg}


def read_sme2(f: h5py.File, grid: Grid) -> dict:
    x = f[f"{SME2}/xCoordinates"][()]
    y = f[f"{SME2}/yCoordinates"][()]
    epsg = int(f[f"{SME2}/projection"][()])
    rows, cols = _window(grid, epsg, x, y)
    sm = np.asarray(f[f"{SME2}/soilMoisture"][rows, cols], dtype=np.float32)
    sm[sm <= SME2_FILL + 1] = np.nan
    return {"sm": sm, "x": x[cols], "y": y[rows], "epsg": epsg}


def _read_opera(f: h5py.File, grid: Grid) -> dict:
    from .opera import read_opera  # opera importa este módulo

    return read_opera(f, grid)


READERS = {"GCOV": read_gcov, "SME2": read_sme2, "OPERA": _read_opera}


def _cache_path(cache_dir: Path, scene: Scene, grid: Grid) -> Path:
    key = hashlib.sha1(f"{grid.crs}{grid.bounds}".encode()).hexdigest()[:10]
    return cache_dir / f"{scene.id}.{key}.npz"


def _fetch_one(args) -> str:
    scene, grid, cache_dir, product, source = args
    path = _cache_path(cache_dir, scene, grid)
    if path.is_file():
        return scene.id
    opener = earthdata_opener(source)
    log.info("Descargando recorte %s %s", product, scene.date)
    with opener(scene.url) as fobj, h5py.File(fobj, "r") as f:
        data = READERS[product](f, grid)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp.npz")
    np.savez_compressed(tmp, **data)
    tmp.replace(path)
    return scene.id


def fetch_scenes(
    scenes: list[Scene], grid: Grid, cache_dir: Path, product: str,
    workers: int = 4, opener: Opener | None = None,
) -> list[dict]:
    """Recortes en paralelo con caché; `opener` permite probar sin red ni procesos."""
    pending = [s for s in scenes if not _cache_path(cache_dir, s, grid).is_file()]
    if pending and opener is None:
        source = require_credentials()
        with ProcessPoolExecutor(workers) as pool:
            list(pool.map(_fetch_one, [(s, grid, cache_dir, product, source) for s in pending]))
    elif pending:
        for s in pending:
            with opener(s.url) as fobj, h5py.File(fobj, "r") as f:
                data = READERS[product](f, grid)
            path = _cache_path(cache_dir, s, grid)
            path.parent.mkdir(parents=True, exist_ok=True)
            np.savez_compressed(path, **data)
    out = []
    for s in scenes:
        with np.load(_cache_path(cache_dir, s, grid)) as z:
            out.append({k: z[k] for k in z.files})
    return out


def to_grid(sub: dict, key: str, grid: Grid) -> np.ndarray:
    ns = SimpleNamespace(x=sub["x"], y=sub["y"], epsg=int(sub["epsg"]))
    return resample(ns, sub[key].astype(np.float32), grid)


def box_blur(field: np.ndarray, radius: int = 1) -> np.ndarray:
    """Promedio de caja que ignora NaN, para quitar moteado antes de clasificar."""
    valid = np.isfinite(field)
    total = np.where(valid, field, 0.0).astype(np.float64)
    count = valid.astype(np.float64)
    for axis in (0, 1):
        t = np.zeros_like(total)
        c = np.zeros_like(count)
        for k in range(-radius, radius + 1):
            t += np.roll(total, k, axis)
            c += np.roll(count, k, axis)
        total, count = t, c
    with np.errstate(invalid="ignore", divide="ignore"):
        out = total / count
    out[~valid] = np.nan
    return out.astype(np.float32)


def change_classes(db_cube: np.ndarray) -> np.ndarray:
    """Por fecha contra la primera: 2 = subió, 3 = bajó, 1 = sin cambio, 0 = sin dato."""
    out = np.ones(db_cube.shape, dtype=np.uint8)
    first = box_blur(db_cube[0])
    for t in range(db_cube.shape[0]):
        diff = box_blur(db_cube[t]) - first
        with np.errstate(invalid="ignore"):
            out[t][diff >= CHANGE_DB] = 2
            out[t][diff <= -CHANGE_DB] = 3
        out[t][~np.isfinite(diff)] = 0
    return out


def water_classes(hh_db: np.ndarray, slope: np.ndarray, permanent: np.ndarray) -> np.ndarray:
    """2 = agua permanente, 3 = agua nueva, 1 = sin agua, 0 = sin dato.

    Un umbral fijo no sirve: el mar (~-18 dB) y la arena seca dan la misma señal. El agua
    permanente viene del mapa de cobertura, y el agua nueva es una caída respecto a lo normal
    de ese píxel: la arena seca es baja pero constante, así que no se marca.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        typical = np.nanmedian(hh_db, axis=0)
    with np.errstate(invalid="ignore"):
        new = (
            (hh_db < WATER_DB)
            & (typical[None] - hh_db >= WATER_DROP_DB)
            & (slope[None] < WATER_MAX_SLOPE_DEG)
        )
    out = np.ones(hh_db.shape, dtype=np.uint8)
    out[new] = 3
    out[:, permanent] = 2
    out[~np.isfinite(hh_db)] = 0
    return out


def disturbance_classes(coherence: np.ndarray) -> np.ndarray:
    """Por par: 2 = la coherencia cae claramente bajo la típica del píxel, 1 = normal, 0 = sin dato."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        typical = np.nanmedian(coherence, axis=0)
    with np.errstate(invalid="ignore"):
        drop = typical[None] - coherence
        out = np.ones(coherence.shape, dtype=np.uint8)
        out[drop >= COHERENCE_DROP] = 2
    out[~np.isfinite(coherence)] = 0
    return out


def iso_dates(scenes: list[Scene]) -> list[date]:
    return [date.fromisoformat(s.date) for s in scenes]
