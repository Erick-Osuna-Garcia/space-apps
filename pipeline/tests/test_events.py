from datetime import date, timedelta

import numpy as np

from nisar_pipeline.config import load_config
from nisar_pipeline.events import (
    class_events,
    components,
    describe_place,
    rate_change,
    subsidence_events,
    to_json,
)
from nisar_pipeline.grid import make_grid

from .test_config import ROOT

CFG = load_config(ROOT / "regions.yaml")
REGION = CFG.regions[0]
GRID = make_grid(REGION.bbox, "EPSG:32611", 64)  # celdas de ~1 km
DATES = [date(2018, 1, 1) + timedelta(days=90 * k) for k in range(30)]


def test_components_uses_eight_neighbors():
    m = np.array([[1, 0, 0], [0, 1, 0], [0, 0, 0], [1, 1, 0]], bool)
    sizes = sorted(c.size for c in components(m))
    assert sizes == [2, 2]


def test_describe_place_gives_distance_and_direction():
    c, r = GRID.lonlat_to_colrow(-115.24, 32.40)
    assert describe_place(REGION, GRID, c, r) == "Planta geotérmica Cerro Prieto"
    east = describe_place(REGION, GRID, c + 10, r)
    assert "al este de Planta" in east


def test_rate_change_finds_breakpoint():
    t = np.arange(30, dtype=float)
    series = np.where(t < 15, -0.5 * t, -7.5 - 2.0 * (t - 15)).astype(np.float32)
    k, before, after = rate_change(series, DATES)
    assert abs(k - 15) <= 1
    assert after < before < 0


def test_rate_change_short_series_returns_none():
    assert rate_change(np.zeros(5, np.float32), DATES[:5]) is None


def _cube(rate_after=None):
    cube = np.zeros((len(DATES), GRID.height, GRID.width), np.float32)
    for k in range(len(DATES)):
        step = -0.5 * k if rate_after is None or k < 15 else -7.5 + rate_after * (k - 15)
        cube[k, 20:30, 20:30] = step
    return cube


def test_subsidence_event_reports_zone_and_magnitude():
    ev = subsidence_events(_cube(), DATES, REGION, GRID, "nisar")
    assert [e.type for e in ev] == ["subsidence"]
    assert "hasta 14 cm" in ev[0].title or "hasta 15 cm" in ev[0].title
    assert ev[0].areaKm2 > 50


def test_rate_change_event_when_zone_accelerates():
    ev = subsidence_events(_cube(rate_after=-3.0), DATES, REGION, GRID, "nisar")
    kinds = {e.type: e for e in ev}
    assert "se aceleró" in kinds["rate-change"].title


def test_no_events_without_change():
    assert subsidence_events(np.zeros((30, 8, 8), np.float32), DATES,
                             REGION, make_grid(REGION.bbox, "EPSG:32611", 8), "nisar") == []


def test_class_events_filters_small_and_dedupes_same_place():
    cube = np.ones((3, GRID.height, GRID.width), np.uint8)
    cube[0, 5:10, 5:10] = 3
    cube[1, 5:10, 5:10] = 3      # mismo lugar: un solo evento
    cube[2, 40, 40] = 3          # muy pequeño
    ev = class_events(cube, 3, ["2026-01-01", "2026-02-01", "2026-03-01"], REGION, GRID,
                      kind="water", min_km2=1, title="Agua nueva: {area:.0f} km²", detail="d")
    assert len(ev) == 1
    assert ev[0].date in {"2026-01-01", "2026-02-01"}
    assert ev[0].title.startswith("Agua nueva")


def test_to_json_sorts_newest_first():
    a = subsidence_events(_cube(), DATES, REGION, GRID, "nisar")
    b = class_events(np.full((1, 4, 4), 3, np.uint8), 3, ["2030-01-01"], REGION,
                     make_grid(REGION.bbox, "EPSG:32611", 4), kind="w", min_km2=1, title="x", detail="y")
    assert to_json(a + b)[0]["date"] == "2030-01-01"


def test_isolated_parcels_are_not_a_zone():
    cube = np.zeros((len(DATES), GRID.height, GRID.width), np.float32)
    cube[-1, 10, 10] = -40   # parcela suelta con un salto
    cube[-1, 30, 30] = -40
    assert subsidence_events(cube, DATES, REGION, GRID, "nisar") == []
