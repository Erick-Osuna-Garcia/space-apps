from datetime import date

import numpy as np

from nisar_pipeline.build import plan_synthetic, run
from nisar_pipeline.config import load_config
from nisar_pipeline.export import decode_cube
from nisar_pipeline.grid import make_grid
from nisar_pipeline.manifest import Manifest
from nisar_pipeline.synthetic import synthetic_dates, synthetic_subsidence

from .test_config import ROOT


def test_synthetic_cube_properties():
    g = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 96)
    center = g.lonlat_to_colrow(-115.24, 32.40)
    dates = synthetic_dates(date(2025, 10, 1), date(2026, 10, 31))
    cube = synthetic_subsidence(g, center, dates)
    assert cube.shape == (len(dates), g.height, g.width)
    valid0 = cube[0][np.isfinite(cube[0])]
    assert (valid0 == 0).all()
    # el mínimo de la última fecha está cerca de Cerro Prieto y es hundimiento de ~cm
    last = np.nan_to_num(cube[-1], nan=0)
    r, c = np.unravel_index(np.argmin(last), last.shape)
    assert abs(c - center[0]) < 10 and abs(r - center[1]) < 10
    assert last.min() < -8
    # determinista
    np.testing.assert_array_equal(cube, synthetic_subsidence(g, center, dates), strict=False)


def test_run_synthetic_end_to_end(tmp_path):
    cfg = load_config(ROOT / "regions.yaml")
    cfg.output_dir = tmp_path
    cfg.max_grid_size = 64
    for region in cfg.regions:
        region.extras = []  # sin red en los tests

    def flat_dem(grid):
        return np.full((grid.height, grid.width), 5.0, np.float32)

    path = run(cfg, plan_synthetic, dem_loader=flat_dem)
    m = Manifest.model_validate_json(path.read_text())
    mx, tj = m.regions
    assert mx.layers[0].source == "synthetic"
    assert tj.layers[0].source == "synthetic"
    raw = (tmp_path / mx.layers[0].path).read_bytes()
    cube = decode_cube(raw, len(mx.layers[0].dates), mx.height, mx.width)
    assert np.nanmin(cube) < -8

    # re-ejecución -> archivos idénticos (incluido generatedAt)
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    run(cfg, plan_synthetic, dem_loader=flat_dem)
    after = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    assert before == after
