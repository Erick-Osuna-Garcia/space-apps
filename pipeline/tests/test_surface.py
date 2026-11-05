from contextlib import contextmanager
from types import SimpleNamespace

import h5py
import numpy as np
import pytest

from nisar_pipeline.config import StackConfig, load_config
from nisar_pipeline.grid import make_grid
from nisar_pipeline.surface import (
    GCOV,
    SME2,
    Scene,
    block_mean,
    box_blur,
    change_classes,
    disturbance_classes,
    fetch_scenes,
    monthly_scenes,
    read_sme2,
    to_db,
    to_grid,
    water_classes,
)

from .test_config import ROOT

GRID = make_grid((-115.65, 32.20, -115.00, 32.75), "EPSG:32611", 16)
FOOT = {"type": "Polygon", "coordinates": [[[-116, 32], [-114, 32], [-114, 33], [-116, 33], [-116, 32]]]}
HALF = {"type": "Polygon", "coordinates": [[[-115.3, 32], [-114, 32], [-114, 33], [-115.3, 33], [-115.3, 32]]]}


def _res(day, frame=72, foot=FOOT):
    return SimpleNamespace(
        geometry=foot,
        properties={
            "sceneName": f"NISAR_L2_PR_GCOV_033_085_D_072_4005_DHDH_A_{day}T022428_{day}T022503_P05023",
            "url": f"https://x/{day}.h5", "frameNumber": frame,
        },
    )


def test_monthly_scenes_picks_best_coverage_per_month_and_filters_frame():
    region = load_config(ROOT / "regions.yaml").regions[0]
    results = [
        _res("20251005", foot=HALF), _res("20251017"), _res("20251105"),
        _res("20251120", frame=18),
    ]
    seen = {}
    out = monthly_scenes(region, "GCOV", StackConfig(relative_orbit=85, frame=72),
                         search_fn=lambda **k: seen.update(k) or results)
    assert [s.date for s in out] == ["2025-10-17", "2025-11-05"]
    assert seen["relativeOrbit"] == 85 and seen["processingLevel"] == "GCOV"


def test_block_mean_ignores_nan_and_trims():
    a = np.array([[1, 3, 9], [np.nan, 5, 9], [9, 9, 9]], np.float32)
    assert block_mean(a, 2).tolist() == [[3.0]]


def test_to_db():
    d = to_db(np.array([1.0, 0.01, 0.0, np.nan], np.float32))
    assert d[0] == 0 and d[1] == pytest.approx(-20)
    assert np.isnan(d[2]) and np.isnan(d[3])


def test_box_blur_keeps_nan():
    f = np.ones((5, 5), np.float32)
    f[2, 2] = np.nan
    b = box_blur(f)
    assert np.isnan(b[2, 2]) and b[1, 1] == pytest.approx(1)


def test_change_classes_marks_block_and_ignores_speckle():
    cube = np.zeros((2, 9, 9), np.float32)
    cube[1, 2:6, 2:6] = 8      # bloque real
    cube[1, 7, 7] = 8          # moteado aislado
    cube[1, 0, 0] = np.nan
    c = change_classes(cube)
    assert (c[0][1:] == 1).all()
    assert c[1, 3, 3] == 2
    assert c[1, 7, 7] == 1
    assert c[1, 0, 0] == 0


def test_water_classes_permanent_new_and_shadow():
    t = 5
    hh = np.full((t, 1, 4), -10.0, np.float32)
    hh[:, 0, 0] = -25          # agua permanente
    hh[4, 0, 1] = -25          # agua nueva en una fecha
    hh[:, 0, 2] = -25          # sombra en ladera empinada
    hh[:, 0, 3] = np.nan
    slope = np.array([[1, 1, 30, 1]], np.float32)
    w = water_classes(hh, slope)
    assert (w[:, 0, 0] == 2).all()
    assert w[4, 0, 1] == 3 and w[0, 0, 1] == 1
    assert (w[:, 0, 2] == 1).all()
    assert (w[:, 0, 3] == 0).all()


def test_disturbance_classes():
    coh = np.full((5, 1, 3), 0.8, np.float32)
    coh[2, 0, 0] = 0.3
    coh[:, 0, 1] = 0.2         # siempre baja: no es un disturbio
    coh[1, 0, 2] = np.nan
    d = disturbance_classes(coh)
    assert d[2, 0, 0] == 2 and d[1, 0, 0] == 1
    assert (d[:, 0, 1] == 1).all()
    assert d[1, 0, 2] == 0


def _gcov_file(path):
    x = np.arange(GRID.bounds[0] - 500, GRID.bounds[2] + 500, 500.0)
    y = np.arange(GRID.bounds[3] + 500, GRID.bounds[1] - 500, -500.0)
    with h5py.File(path, "w") as f:
        f[f"{GCOV}/xCoordinates"] = x
        f[f"{GCOV}/yCoordinates"] = y
        f[f"{GCOV}/projection"] = np.uint32(32611)
        f[f"{GCOV}/HHHH"] = np.full((y.size, x.size), 0.1, np.float32)
        f[f"{GCOV}/HVHV"] = np.full((y.size, x.size), 0.01, np.float32)
    return path


def test_fetch_scenes_reads_caches_and_resamples(tmp_path):
    path = _gcov_file(tmp_path / "g.h5")
    opened = []

    @contextmanager
    def opener(url):
        opened.append(url)
        with open(url, "rb") as f:
            yield f

    scene = Scene("G1", str(path), "2025-10-05", 1.0)
    subs = fetch_scenes([scene], GRID, tmp_path / "c", "GCOV", opener=opener)
    fetch_scenes([scene], GRID, tmp_path / "c", "GCOV", opener=opener)
    assert len(opened) == 1
    out = to_grid(subs[0], "hh", GRID)
    assert out.shape == (GRID.height, GRID.width)
    assert np.nanmean(out) == pytest.approx(0.1, abs=1e-3)


def test_read_sme2_masks_fill(tmp_path):
    x = np.arange(GRID.bounds[0] - 500, GRID.bounds[2] + 500, 500.0)
    y = np.arange(GRID.bounds[3] + 500, GRID.bounds[1] - 500, -500.0)
    sm = np.full((y.size, x.size), 0.25, np.float32)
    sm[10, 10] = -9999
    with h5py.File(tmp_path / "s.h5", "w") as f:
        f[f"{SME2}/xCoordinates"] = x
        f[f"{SME2}/yCoordinates"] = y
        f[f"{SME2}/projection"] = np.uint32(32611)
        f[f"{SME2}/soilMoisture"] = sm
    with h5py.File(tmp_path / "s.h5") as f:
        out = read_sme2(f, GRID)
    assert np.isnan(out["sm"]).sum() == 1
