import json
from pathlib import Path

import numpy as np
import pytest

from nisar_pipeline.export import (
    NODATA,
    BudgetError,
    bytes_needed,
    check_budget,
    decode_cube,
    encode_cube,
    encode_terrain,
    fit_grid_to_budget,
    write_bin,
    write_manifest,
)
from nisar_pipeline.grid import make_grid
from nisar_pipeline.manifest import Manifest

FIXTURE = Path(__file__).parent / "fixtures" / "manifest.sample.json"
GRID = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 512)


def test_cube_roundtrip(tmp_path):
    cube = np.array([[[0.0, -1.23], [np.nan, 5.0]], [[-12.34, np.nan], [0.05, 3276.0]]], np.float32)
    enc = encode_cube(cube)
    assert enc.dtype == np.dtype("<i2")
    assert enc[0, 1, 0] == NODATA
    n = write_bin(tmp_path / "c.bin", enc)
    assert n == cube.size * 2
    dec = decode_cube((tmp_path / "c.bin").read_bytes(), 2, 2, 2)
    np.testing.assert_array_equal(np.isnan(dec), np.isnan(cube))
    ok = np.isfinite(cube)
    np.testing.assert_allclose(dec[ok], cube[ok], atol=0.05)


def test_terrain_encoding_rounds_and_clips():
    enc = encode_terrain(np.array([[1.4, 1.6], [-50000.0, 99999.0]]))
    assert enc.tolist() == [[1, 2], [-32767, 32767]]


def test_budget_fits_unchanged():
    assert fit_grid_to_budget(GRID, 10, 15_000_000, "mx") is GRID


def test_budget_reduces_resolution():
    budget = 5_000_000
    assert bytes_needed(GRID, 30) > budget
    fitted = fit_grid_to_budget(GRID, 30, budget, "mx")
    assert bytes_needed(fitted, 30) <= budget
    assert fitted.width < GRID.width
    assert fitted.width * fitted.cell == pytest.approx(GRID.width * GRID.cell)


def test_budget_fails_when_impossible():
    with pytest.raises(BudgetError, match="no caben"):
        fit_grid_to_budget(GRID, 1000, 100_000, "mx")


def test_check_budget_reports_size():
    with pytest.raises(BudgetError, match="exceden"):
        check_budget("mx", 20_000_000, 15_000_000)


def test_manifest_rejects_missing_files(tmp_path):
    m = Manifest.model_validate_json(FIXTURE.read_text())
    with pytest.raises(FileNotFoundError):
        write_manifest(tmp_path, m)


def test_manifest_written_when_files_exist(tmp_path):
    m = Manifest.model_validate_json(FIXTURE.read_text())
    for r in m.regions:
        for p in [
            r.terrain.path,
            *(layer.path for layer in r.layers),
            *(o.path for o in r.overlays),
        ]:
            (tmp_path / p).parent.mkdir(parents=True, exist_ok=True)
            (tmp_path / p).write_bytes(b"\0\0")
    out = write_manifest(tmp_path, m)
    assert json.loads(out.read_text())["schemaVersion"] == 2
