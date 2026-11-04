"""Orquestación por región: grilla -> presupuesto -> DEM -> capas -> binarios -> manifiesto."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np

from . import manifest as mf
from .config import LayerConfig, PipelineConfig, RegionConfig
from .dem import load_dem
from .export import (
    check_budget,
    encode_cube,
    encode_terrain,
    fit_grid_to_budget,
    write_bin,
    write_manifest,
)
from .grid import Grid, make_grid
from .synthetic import synthetic_dates, synthetic_subsidence

log = logging.getLogger(__name__)

LAYER_TEXT = {
    "los-displacement": (
        "Hundimiento (desplazamiento LOS)",
        "Desplazamiento acumulado del suelo en la línea de vista del radar desde la primera "
        "fecha. Valores negativos = el suelo se aleja del satélite (hundimiento).",
    ),
}


@dataclass
class LayerPlan:
    """Lo que una capa necesita saber antes de fijar la grilla, y cómo construirse después."""

    config: LayerConfig
    dates: list[date]
    source: str
    products: list[str]
    credits: list[mf.Credit]
    build: Callable[[Grid], np.ndarray]  # -> (T, H, W) cm, NaN = sin dato


Planner = Callable[[PipelineConfig, RegionConfig, LayerConfig], LayerPlan]


def plan_synthetic(cfg: PipelineConfig, region: RegionConfig, layer: LayerConfig) -> LayerPlan:
    dates = synthetic_dates(*region.date_range)
    poi = next((p for p in region.pois if p.id == "cerro-prieto"), None)
    lon = poi.lon if poi else (region.bbox[0] + region.bbox[2]) / 2
    lat = poi.lat if poi else (region.bbox[1] + region.bbox[3]) / 2

    def build(grid: Grid) -> np.ndarray:
        return synthetic_subsidence(grid, grid.lonlat_to_colrow(lon, lat), dates)

    return LayerPlan(layer, dates, "synthetic", [], [mf.SYNTHETIC_CREDIT], build)


def build_region(
    cfg: PipelineConfig,
    region: RegionConfig,
    planner: Planner,
    dem_loader: Callable[[Grid], np.ndarray] = load_dem,
) -> mf.Region:
    budget = int(cfg.size_budget_mb * 1_000_000)
    grid = make_grid(region.bbox, cfg.projection, cfg.max_grid_size)
    plans = [planner(cfg, region, layer) for layer in region.layers]
    grid = fit_grid_to_budget(grid, sum(len(p.dates) for p in plans), budget, region.id)
    log.info("%s: grilla %dx%d, celda %.1f m", region.id, grid.width, grid.height, grid.cell)

    out_dir = cfg.output_dir
    dem = dem_loader(grid)
    terrain_path = f"{region.id}/terrain.bin"
    total = write_bin(out_dir / terrain_path, encode_terrain(dem))

    layers_out: list[mf.Layer] = []
    for plan in plans:
        cube = plan.build(grid)
        expected = (len(plan.dates), grid.height, grid.width)
        if cube.shape != expected:
            raise ValueError(f"{region.id}/{plan.config.id}: cubo {cube.shape} != {expected}")
        path = f"{region.id}/{plan.config.id}/cube.bin"
        total += write_bin(out_dir / path, encode_cube(cube))
        valid = cube[np.isfinite(cube)]
        name, description = LAYER_TEXT[plan.config.type]
        layers_out.append(
            mf.Layer(
                id=plan.config.id,
                type=plan.config.type,
                name=name,
                description=description,
                units="cm",
                path=path,
                scale=0.1,
                dates=[d.isoformat() for d in plan.dates],
                valueRange=(round(float(valid.min()), 2), round(float(valid.max()), 2))
                if valid.size
                else (0.0, 0.0),
                source=plan.source,
                products=plan.products,
                credits=plan.credits,
            )
        )
    check_budget(region.id, total, budget)
    log.info("%s: %.2f MB de assets", region.id, total / 1e6)

    corners = grid.corner_lonlat()
    pois = []
    for p in region.pois:
        col, row = grid.lonlat_to_colrow(p.lon, p.lat)
        pois.append(
            mf.PoiOut(id=p.id, name=p.name, description=p.description, lon=p.lon, lat=p.lat,
                      col=round(col, 3), row=round(row, 3))
        )
    return mf.Region(
        id=region.id,
        name=region.name,
        bbox=region.bbox,
        bboxProjected=tuple(round(v, 2) for v in grid.bounds),
        corners=mf.Corners(**corners),
        width=grid.width,
        height=grid.height,
        cellSizeM=round(grid.cell, 3),
        terrain=mf.Terrain(
            path=terrain_path,
            heightRange=(float(dem.min().round()), float(dem.max().round())),
            credits=[mf.COPERNICUS_CREDIT],
        ),
        pois=pois,
        layers=layers_out,
    )


def run(cfg: PipelineConfig, planner: Planner, dem_loader=load_dem) -> Path:
    regions = [build_region(cfg, r, planner, dem_loader) for r in cfg.regions]
    manifest = mf.Manifest(
        generatedAt=_stable_timestamp(cfg.output_dir / "manifest.json", regions, cfg.projection),
        projection=cfg.projection,
        regions=regions,
    )
    return write_manifest(cfg.output_dir, manifest)


def _stable_timestamp(existing: Path, regions: list[mf.Region], projection: str) -> str:
    """Conserva generatedAt si el contenido no cambió, para que re-ejecutar dé archivos idénticos."""
    now = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if not existing.is_file():
        return now
    try:
        old = json.loads(existing.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return now
    new_body = {
        "projection": projection,
        "regions": [r.model_dump(mode="json") for r in regions],
    }
    old_body = {"projection": old.get("projection"), "regions": old.get("regions")}
    same = json.dumps(new_body, sort_keys=True) == json.dumps(old_body, sort_keys=True)
    return old.get("generatedAt", now) if same else now
