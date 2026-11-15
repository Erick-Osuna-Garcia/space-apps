import json

import numpy as np
import pytest

from nisar_pipeline.config import load_config
from nisar_pipeline.extras import (
    active_slopes,
    build_extras,
    ejido_name,
    ejidos_to_grid,
    osm_to_grid,
    overpass_query,
    remap_landcover,
    slope_degrees,
    worldcover_tiles,
)
from nisar_pipeline.grid import make_grid
from nisar_pipeline.timeseries import velocity_from_cube

from .test_config import ROOT

GRID = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 32)


def test_slope_of_known_ramp():
    dem = np.tile(np.arange(8, dtype=np.float32) * 100, (8, 1))  # 100 m por celda de 100 m
    assert slope_degrees(dem, 100)[4, 4] == pytest.approx(45, abs=0.1)
    assert slope_degrees(np.zeros((4, 4)), 100).max() == 0


def test_active_slopes_needs_slope_and_motion():
    slope = np.array([[20.0, 20.0, 5.0, 20.0]], np.float32)
    vel = np.array([[-3.0, 0.2, -3.0, np.nan]], np.float32)
    assert active_slopes(slope, vel).tolist() == [[2, 1, 1, 0]]


def test_remap_landcover():
    assert remap_landcover(np.array([[40, 50, 0, 70]], np.uint8)).tolist() == [[5, 6, 0, 0]]


def test_worldcover_tiles_cover_grid():
    assert worldcover_tiles(GRID) == ["N30W117"]
    tj = make_grid((-117.15, 32.40, -116.80, 32.60), "EPSG:32611", 32)
    assert set(worldcover_tiles(tj)) == {"N30W120", "N30W117"}


def test_osm_to_grid_splits_clips_and_simplifies():
    data = {"elements": [
        {"tags": {"highway": "primary", "name": "Carretera"},
         "geometry": [{"lon": -115.5, "lat": 32.5}, {"lon": -115.4, "lat": 32.5}, {"lon": -115.3, "lat": 32.5}]},
        {"tags": {"waterway": "canal"},
         "geometry": [{"lon": -115.5, "lat": 32.4}, {"lon": -115.4, "lat": 32.4}]},
        {"tags": {"highway": "primary"},
         "geometry": [{"lon": -100.0, "lat": 20.0}, {"lon": -100.1, "lat": 20.0}]},
    ]}
    out = osm_to_grid(data, GRID)
    assert len(out["road"]) == 1 and len(out["canal"]) == 1
    assert out["road"][0]["name"] == "Carretera"
    assert len(out["road"][0]["points"]) == 2  # la línea recta se simplifica


def test_overpass_query_uses_south_west_north_east():
    query = overpass_query((-115.65, 32.20, -115.00, 32.75))
    assert "(32.2,-115.65,32.75,-115.0)" in query
    assert 'way["waterway"="river"]' in query


def test_osm_keeps_rivers_out_of_canals():
    data = {"elements": [
        {"tags": {"waterway": "canal", "name": "Canal"},
         "geometry": [{"lon": -115.5, "lat": 32.4}, {"lon": -115.4, "lat": 32.4}]},
        {"tags": {"waterway": "river", "name": "Hardy"},
         "geometry": [{"lon": -115.5, "lat": 32.3}, {"lon": -115.4, "lat": 32.3}]},
    ]}
    out = osm_to_grid(data, GRID)
    assert len(out["canal"]) == 1 and out["canal"][0]["class"] == "canal"
    assert len(out["river"]) == 1 and out["river"][0]["class"] == "river"
    assert out["river"][0]["name"] == "Hardy"


def test_build_extras_with_fakes(tmp_path):
    cfg = load_config(ROOT / "regions.yaml")
    region = cfg.regions[0].model_copy(
        update={"extras": ["slope", "active-slopes", "landcover", "population", "infrastructure"]}
    )
    cfg.cache_dir = tmp_path
    shape = (GRID.height, GRID.width)
    layers, overlays = build_extras(
        cfg, region, GRID, np.zeros(shape, np.float32), np.zeros(shape, np.float32), tmp_path,
        fetch=lambda r, c: {"elements": []},
        landcover=lambda g: np.full(shape, 5, np.uint8),
        population=lambda g, c: np.full(shape, 7.4, np.float32),
        ejidos=lambda r, c: {"type": "FeatureCollection", "features": []},
    )
    assert [e.layer.id for e in layers] == ["slope", "active-slopes", "landcover", "population"]
    assert all(e.data.shape == (1, *shape) for e in layers)
    assert layers[3].data.max() == 7
    assert [o.id for o in overlays] == ["roads", "canals", "rivers"]
    assert json.loads((tmp_path / "mexicali/roads.json").read_text()) == []


def test_ejido_name_strips_prefix_and_title_cases():
    assert ejido_name("EJIDO ZACATECAS") == "Zacatecas"
    assert ejido_name("DR.ALBERTO OVIEDO MOTA NO.1\r\n") == "Dr. Alberto Oviedo Mota No. 1"


def test_ejidos_to_grid_clips_and_labels_centroid():
    west, south, east, north = -115.65, 32.20, -115.00, 32.75
    collection = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"nombre_nuc": "EJIDO ZACATECAS"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [west + 0.05, south + 0.05],
                        [west + 0.20, south + 0.05],
                        [west + 0.20, south + 0.20],
                        [west + 0.05, south + 0.20],
                        [west + 0.05, south + 0.05],
                    ]],
                },
            },
            {
                "type": "Feature",
                "properties": {"nombre_nuc": "AFUERA"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[-100.0, 20.0], [-99.9, 20.0], [-99.9, 20.1], [-100.0, 20.1], [-100.0, 20.0]]],
                },
            },
        ],
    }
    out = ejidos_to_grid(collection, GRID)
    assert len(out) == 1
    assert out[0]["name"] == "Zacatecas"
    assert len(out[0]["rings"][0]) >= 4
    assert 0 < out[0]["col"] < GRID.width
    assert 0 < out[0]["row"] < GRID.height


def test_velocity_from_cube():
    from datetime import date
    dates = [date(2024, 1, 1), date(2025, 1, 1), date(2026, 1, 1)]
    cube = np.array([[[0.0, 0.0]], [[-10.0, np.nan]], [[-20.0, np.nan]]], np.float32)
    v = velocity_from_cube(cube, dates)
    assert v[0, 0] == pytest.approx(-10, abs=0.1)
    assert np.isnan(v[0, 1])
