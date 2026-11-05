"""Planner de capas con datos NISAR GUNW reales: descubrir -> recortes -> serie de tiempo."""

from __future__ import annotations

import logging
from datetime import date

from pathlib import Path
from types import SimpleNamespace

import h5py
import numpy as np

from . import manifest as mf
from .build import LayerPlan
from .config import LayerConfig, PipelineConfig, RegionConfig
from .discover import Discovery, discover, write_report
from .download import Opener, earthdata_opener, fetch_subsets, require_credentials
from .grid import Grid
from .gunw import GunwSubset, main_component_mask, resample
from .timeseries import (
    coherence_invalid,
    deramp,
    fill_network_gaps,
    invert_network,
    phase_to_los_cm,
    reject_outliers,
    smooth_series,
    subtract_reference,
    decompose,
    velocity_from_cube,
)

log = logging.getLogger(__name__)

DERAMP_MIN_COHERENCE = 0.5


def layer_center(region: RegionConfig) -> tuple[float, float]:
    poi = next((p for p in region.pois if p.id == "cerro-prieto"), None)
    if poi:
        return (poi.lon, poi.lat)
    b = region.bbox
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def reference_mask(grid: Grid, bbox) -> np.ndarray:
    c0, r0 = grid.lonlat_to_colrow(bbox[0], bbox[3])
    c1, r1 = grid.lonlat_to_colrow(bbox[2], bbox[1])
    mask = np.zeros((grid.height, grid.width), dtype=bool)
    rs, re = max(0, int(np.floor(r0))), min(grid.height, int(np.ceil(r1)))
    cs, ce = max(0, int(np.floor(c0))), min(grid.width, int(np.ceil(c1)))
    mask[rs:re, cs:ce] = True
    if not mask.any():
        raise ValueError("reference_bbox no cae dentro de la grilla")
    return mask


def build_series(
    subsets: list[GunwSubset], dates: list[date], grid: Grid, layer: LayerConfig,
    aux: dict | None = None, center: tuple[float, float] | None = None,
) -> np.ndarray:
    index = {d.isoformat(): i for i, d in enumerate(dates)}
    ref = reference_mask(grid, layer.reference_bbox)
    pairs, ifgs, cohs = [], [], []
    for sub in subsets:
        cohs.append(resample(sub, sub.coherence, grid))
    stable = np.nanmedian(np.stack(cohs), axis=0) > DERAMP_MIN_COHERENCE
    if layer.deramp_exclude_km > 0 and center is not None:
        col, row = grid.lonlat_to_colrow(*center)
        yy, xx = np.mgrid[0 : grid.height, 0 : grid.width]
        radius = layer.deramp_exclude_km * 1000 / grid.cell
        stable &= np.hypot(xx - col, yy - row) > radius
    for sub in subsets:
        raw = np.where(main_component_mask(sub.components), sub.phase, np.nan)
        phase = resample(sub, raw, grid)
        if layer.ionosphere_correction:
            phase = phase - resample(sub, sub.ionosphere, grid)
        los = phase_to_los_cm(phase, sub.wavelength_m)
        ifgs.append(subtract_reference(deramp(subtract_reference(los, ref), stable), ref))
        pairs.append((index[sub.ref_date], index[sub.sec_date]))
    all_pairs, filled = fill_network_gaps(pairs, np.stack(ifgs), dates)
    cube = smooth_series(invert_network(all_pairs, filled, len(dates)))
    cube[:, coherence_invalid(np.stack(cohs), layer.coherence_threshold)] = np.nan
    cube = reject_outliers(cube)
    if aux is not None:
        aux["coherence"] = np.stack(cohs)
        aux["pair_dates"] = [sub.sec_date for sub in subsets]
    return cube


def plan_nisar(
    cfg: PipelineConfig, region: RegionConfig, layer: LayerConfig,
    discovery: Discovery | None = None, opener: Opener | None = None,
) -> LayerPlan:
    cache = cfg.cache_dir / region.id / layer.id
    disc = discovery or discover(region, layer, layer_center(region))
    report = write_report(disc, cache / "discovery.json")
    log.info(
        "%s/%s: stack %s con %d pares y %d fechas (reporte: %s)",
        region.id, layer.id, disc.chosen, len(disc.products), len(disc.dates), report,
    )
    if opener is None:
        source = require_credentials()  # aborta antes de cualquier descarga
        log.info("Credenciales Earthdata encontradas (%s)", source)
    dates = disc.dates

    def build(grid: Grid) -> np.ndarray:
        op = opener or earthdata_opener(require_credentials())
        subsets = fetch_subsets(disc.products, grid, cache / "subsets", op, layer.polarization)
        plan.aux["products"] = [p.id for p in disc.products]
        return build_series(subsets, dates, grid, layer, plan.aux, layer_center(region))

    plan = LayerPlan(
        config=layer,
        dates=dates,
        source="nisar",
        products=[p.id for p in disc.products],
        credits=[mf.NISAR_CREDIT],
        build=build,
    )
    return plan


RADAR_GRID = "/science/LSAR/GUNW/metadata/radarGrid"


def read_geometry(f) -> dict:
    """Vector suelo→satélite (este, norte) en la capa de altura más cercana a 0."""
    heights = f[f"{RADAR_GRID}/heightAboveEllipsoid"][()]
    k = int(np.argmin(np.abs(heights)))
    return {
        "ex": np.asarray(f[f"{RADAR_GRID}/losUnitVectorX"][k], dtype=np.float32),
        "ey": np.asarray(f[f"{RADAR_GRID}/losUnitVectorY"][k], dtype=np.float32),
        "x": f[f"{RADAR_GRID}/xCoordinates"][()],
        "y": f[f"{RADAR_GRID}/yCoordinates"][()],
        "epsg": int(f[f"{RADAR_GRID}/projection"][()]),
    }


def stack_geometry(
    cache: Path, product, grid: Grid, opener: Opener
) -> tuple[np.ndarray, np.ndarray]:
    """Componentes este y vertical del vector de observación, en la grilla."""
    path = cache / f"geometry-{product.relative_orbit}-{product.frame}.npz"
    if not path.is_file():
        with opener(product.url) as fobj, h5py.File(fobj, "r") as f:
            geom = read_geometry(f)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(path, **geom)
    with np.load(path) as z:
        ns = SimpleNamespace(x=z["x"], y=z["y"], epsg=int(z["epsg"]))
        ex = resample(ns, z["ex"], grid)
        ey = resample(ns, z["ey"], grid)
    return ex, np.sqrt(np.clip(1 - ex**2 - ey**2, 0, 1))


def decomposition(
    cfg: PipelineConfig, region: RegionConfig, layer: LayerConfig, grid: Grid,
    velocity: np.ndarray, primary_products: list[str],
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Velocidad vertical y este combinando el stack principal con el de la otra órbita."""
    opener = earthdata_opener(require_credentials())
    cache = cfg.cache_dir / region.id / layer.id
    other = layer.model_copy(update={"stack": layer.secondary_stack})
    disc = discover(region, other, layer_center(region))
    subsets = fetch_subsets(disc.products, grid, cache / "subsets", opener, layer.polarization)
    cube = build_series(subsets, disc.dates, grid, other, None, layer_center(region))
    v2 = velocity_from_cube(cube, disc.dates)
    main = discover(region, layer, layer_center(region))
    e1, u1 = stack_geometry(cache, main.products[-1], grid, opener)
    e2, u2 = stack_geometry(cache, disc.products[-1], grid, opener)
    up, east = decompose(velocity, e1, u1, v2, e2, u2)
    return up, east, primary_products + [p.id for p in disc.products]
