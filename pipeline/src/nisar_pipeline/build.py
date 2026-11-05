"""Orquestación por región: grilla -> presupuesto -> DEM -> capas -> binarios -> manifiesto."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np

from . import events as ev
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
from .extras import build_extras
from .grid import Grid, make_grid
from .synthetic import synthetic_dates, synthetic_subsidence
from .timeseries import velocity_from_cube

log = logging.getLogger(__name__)

LAYER_TEXT = {
    "los-displacement": (
        "Hundimiento (desplazamiento LOS)",
        "Desplazamiento acumulado del suelo en la línea de vista del radar desde la primera "
        "fecha. Valores negativos = el suelo se aleja del satélite (hundimiento).",
    ),
}


EVENT_SPECS = [
    ("water", 3, "water", ev.MIN_WATER_KM2, "Agua nueva en {area:.0f} km²",
     "La señal del radar cayó con fuerza respecto a lo normal aquí."),
    ("disturbance", 2, "disturbance", ev.MIN_DISTURBANCE_KM2, "Cambio brusco en {area:.0f} km²",
     "El radar perdió coherencia entre dos pasadas: algo cambió aquí."),
    ("change", 2, "change", ev.MIN_CHANGE_KM2, "Señal más fuerte en {area:.0f} km²",
     "La superficie devuelve más señal que al inicio de la serie."),
]


@dataclass
class LayerPlan:
    """Lo que una capa necesita saber antes de fijar la grilla, y cómo construirse después."""

    config: LayerConfig
    dates: list[date]
    source: str
    products: list[str]
    credits: list[mf.Credit]
    build: Callable[[Grid], np.ndarray]  # -> (T, H, W) cm, NaN = sin dato
    aux: dict = field(default_factory=dict)  # datos para capas derivadas (p. ej. coherencia)


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
    velocity = None
    aux: dict = {}
    event_list: list[ev.Event] = []
    for plan in plans:
        cube = plan.build(grid)
        if plan.config.type == "los-displacement":
            velocity = velocity_from_cube(cube, plan.dates)
            aux = plan.aux
        expected = (len(plan.dates), grid.height, grid.width)
        if cube.shape != expected:
            raise ValueError(f"{region.id}/{plan.config.id}: cubo {cube.shape} != {expected}")
        dates, segments, products = plan.dates, [], plan.products
        credits = plan.credits
        if plan.config.history and "stable" in plan.aux:
            from .nisar import extend_with_history  # nisar importa este módulo

            cube, dates, junction, opera_ids = extend_with_history(
                cfg, region, plan.config, grid, cube, plan.dates, plan.aux["stable"]
            )
            segments = [
                mf.Segment(until=junction.isoformat(), source="sentinel-1"),
                mf.Segment(until=dates[-1].isoformat(), source="nisar"),
            ]
            products = products + opera_ids
            credits = [*credits, mf.OPERA_CREDIT]
        path = f"{region.id}/{plan.config.id}/cube.bin"
        total += write_bin(out_dir / path, encode_cube(cube))
        event_list += ev.subsidence_events(
            cube, dates, region, grid, "sentinel-1 + nisar" if segments else plan.source
        )
        valid = cube[np.isfinite(cube)]
        name, description = LAYER_TEXT[plan.config.type]
        layers_out.append(
            mf.Layer(
                id=plan.config.id,
                type=plan.config.type,
                theme="movement",
                name=name,
                description=description,
                units="cm",
                path=path,
                scale=0.1,
                dates=[d.isoformat() for d in dates],
                # percentiles: unos pocos píxeles extremos no deben aplanar la escala de color
                valueRange=tuple(round(float(v), 2) for v in np.percentile(valid, [0.1, 99.9]))
                if valid.size
                else (0.0, 0.0),
                source=plan.source,
                products=products,
                credits=credits,
                segments=segments,
            )
        )
    extra_layers, overlays = build_extras(cfg, region, grid, dem, velocity, out_dir, aux)
    for extra in extra_layers:
        total += write_bin(out_dir / extra.layer.path, extra.data)
        layers_out.append(extra.layer)
    by_id = {e.layer.id: e for e in extra_layers}
    for lid, value, kind, min_km2, title, detail in EVENT_SPECS:
        extra = by_id.get(lid)
        if extra:
            event_list += ev.class_events(
                extra.data, value, extra.layer.dates, region, grid,
                kind=kind, min_km2=min_km2, title=title, detail=detail,
            )
    events_path = None
    if event_list:
        events_path = f"{region.id}/events.json"
        (out_dir / events_path).write_text(
            json.dumps(ev.to_json(event_list), ensure_ascii=False, indent=1), encoding="utf-8"
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
        overlays=overlays,
        events=events_path,
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
