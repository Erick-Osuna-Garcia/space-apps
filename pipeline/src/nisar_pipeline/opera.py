"""Historia larga con OPERA DISP-S1 (Sentinel-1), para extender la línea de tiempo antes de NISAR."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date

import h5py
import numpy as np

from .config import HistoryConfig, RegionConfig
from .grid import Grid
from .surface import Scene, _window, block_mean, to_grid
from .timeseries import (
    deramp,
    fill_network_gaps,
    invert_network,
    subtract_reference,
)

log = logging.getLogger(__name__)

URL = "https://cumulus.asf.earthdatacloud.nasa.gov/OPERA/OPERA_L3_DISP-S1_V1/{n}/{n}.nc"
DECIMATE = 4  # 30 m -> 120 m, la celda de la grilla
_NAME = re.compile(r"_F(\d+)_VV_(\d{8})T\d+Z_(\d{8})T\d+Z_v[\d.]+_(\d{8})")


def _iso(d: str) -> str:
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


@dataclass(frozen=True)
class Item:
    id: str
    ref: str
    sec: str
    version: str


def parse_items(names: list[str], frame: int) -> list[Item]:
    """Productos del frame, uno por par: el de procesamiento más reciente."""
    best: dict[tuple[str, str], Item] = {}
    for raw in names:
        name = raw.removesuffix(".nc")
        m = _NAME.search(name)
        if not m or int(m.group(1)) != frame:
            continue
        item = Item(name, _iso(m.group(2)), _iso(m.group(3)), m.group(4))
        key = (item.ref, item.sec)
        if key not in best or item.version > best[key].version:
            best[key] = item
    return sorted(best.values(), key=lambda i: i.sec)


def select_items(items: list[Item], min_gap_days: int) -> list[Item]:
    """Lo mínimo para encadenar la serie: las fechas de referencia y una cada `min_gap_days`.

    Cada grupo mide desde su fecha de referencia, así que el producto cuya fecha es la siguiente
    referencia es obligatorio: es el eslabón entre grupos.
    """
    refs = {i.ref for i in items}
    chosen: list[Item] = []
    last: date | None = None
    for item in items:
        d = date.fromisoformat(item.sec)
        is_link = item.sec in refs
        if is_link or last is None or (d - last).days >= min_gap_days:
            chosen.append(item)
            last = d
    if items and chosen[-1] is not items[-1]:
        chosen.append(items[-1])
    return chosen


def search_items(region: RegionConfig, history: HistoryConfig) -> list[Item]:
    import asf_search as asf
    from shapely.geometry import box

    results = asf.search(
        dataset=asf.DATASET.OPERA_S1, processingLevel="DISP-S1",
        intersectsWith=box(*region.bbox).wkt, maxResults=6000,
    )
    names = [r.properties.get("sceneName") or r.properties["fileID"] for r in results]
    return parse_items(names, history.frame)


def to_scene(item: Item) -> Scene:
    return Scene(id=item.id, url=URL.format(n=item.id), date=item.sec, coverage=1.0)


def read_opera(f: h5py.File, grid: Grid) -> dict:
    """Desplazamiento en cm (positivo = hacia el satélite) con la máscara recomendada."""
    x, y = f["x"][()], f["y"][()]
    epsg = int(grid.crs.split(":")[1])
    rows, cols = _window(grid, epsg, x, y)
    disp = np.asarray(f["displacement"][rows, cols], dtype=np.float32) * 100.0
    disp[np.asarray(f["recommended_mask"][rows, cols]) == 0] = np.nan
    n = DECIMATE
    out = block_mean(disp, n)
    xs = x[cols][: out.shape[1] * n].reshape(-1, n).mean(axis=1)
    ys = y[rows][: out.shape[0] * n].reshape(-1, n).mean(axis=1)
    return {"disp": out, "x": xs, "y": ys, "epsg": epsg}


def build_history(
    items: list[Item], subs: list[dict], grid: Grid, ref: np.ndarray, stable: np.ndarray,
) -> tuple[np.ndarray, list[date]]:
    """Serie acumulada (cm) desde la primera fecha de referencia."""
    dates = sorted({date.fromisoformat(i.ref) for i in items[:1]} | {date.fromisoformat(i.sec) for i in items})
    index = {d.isoformat(): k for k, d in enumerate(dates)}
    pairs, ifgs = [], []
    for item, sub in zip(items, subs, strict=True):
        if item.ref not in index:
            continue  # grupo cuya referencia no quedó en la cadena
        disp = to_grid(sub, "disp", grid)
        ifgs.append(subtract_reference(deramp(subtract_reference(disp, ref), stable), ref))
        pairs.append((index[item.ref], index[item.sec]))
    all_pairs, filled = fill_network_gaps(pairs, np.stack(ifgs), dates)
    return invert_network(all_pairs, filled, len(dates)), dates


def merge_with_nisar(
    history: np.ndarray, history_dates: list[date], nisar: np.ndarray, nisar_dates: list[date],
) -> tuple[np.ndarray, list[date], date]:
    """Empalma por píxel: la historia hasta el inicio de NISAR y luego NISAR sumado a ese valor."""
    start = nisar_dates[0]
    before = [k for k, d in enumerate(history_dates) if d <= start]
    if not before:
        raise ValueError("La historia no llega al inicio de NISAR")
    last = before[-1]
    tail = history[last][None] + nisar[1:]
    cube = np.concatenate([history[: last + 1], tail]).astype(np.float32)
    dates = history_dates[: last + 1] + nisar_dates[1:]
    return cube, dates, history_dates[last]


def overlap_rates(
    history: np.ndarray, history_dates: list[date], nisar: np.ndarray, nisar_dates: list[date],
) -> tuple[np.ndarray, np.ndarray]:
    """Velocidad (cm/año) de cada satélite en el periodo en que coinciden, para compararlas."""
    from .timeseries import velocity_from_cube

    start, end = nisar_dates[0], history_dates[-1]
    hk = [k for k, d in enumerate(history_dates) if start <= d <= end]
    nk = [k for k, d in enumerate(nisar_dates) if d <= end]
    return (
        velocity_from_cube(history[hk], [history_dates[k] for k in hk]),
        velocity_from_cube(nisar[nk], [nisar_dates[k] for k in nk]),
    )
