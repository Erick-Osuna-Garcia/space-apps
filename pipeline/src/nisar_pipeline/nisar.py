"""Planner de capas con datos NISAR GUNW reales: descubrir -> recortes -> serie de tiempo."""

from __future__ import annotations

import logging
from datetime import date

import numpy as np

from . import manifest as mf
from .build import LayerPlan
from .config import LayerConfig, PipelineConfig, RegionConfig
from .discover import Discovery, discover, write_report
from .download import Opener, earthdata_opener, fetch_subsets, require_credentials
from .grid import Grid
from .gunw import GunwSubset, resample
from .timeseries import coherence_invalid, invert_network, phase_to_los_cm, subtract_reference

log = logging.getLogger(__name__)


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
    subsets: list[GunwSubset], dates: list[date], grid: Grid, layer: LayerConfig
) -> np.ndarray:
    index = {d.isoformat(): i for i, d in enumerate(dates)}
    ref = reference_mask(grid, layer.reference_bbox)
    pairs, ifgs, cohs = [], [], []
    for sub in subsets:
        phase = resample(sub, sub.phase, grid)
        if layer.ionosphere_correction:
            phase = phase - resample(sub, sub.ionosphere, grid)
        los = phase_to_los_cm(phase, sub.wavelength_m)
        ifgs.append(subtract_reference(los, ref))
        cohs.append(resample(sub, sub.coherence, grid))
        pairs.append((index[sub.ref_date], index[sub.sec_date]))
    cube = invert_network(pairs, np.stack(ifgs), len(dates))
    cube[:, coherence_invalid(np.stack(cohs), layer.coherence_threshold)] = np.nan
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
        return build_series(subsets, dates, grid, layer)

    return LayerPlan(
        config=layer,
        dates=dates,
        source="nisar",
        products=[p.id for p in disc.products],
        credits=[mf.NISAR_CREDIT],
        build=build,
    )
