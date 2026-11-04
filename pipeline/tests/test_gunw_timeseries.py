from datetime import date

import h5py
import numpy as np
import pytest

from nisar_pipeline.config import load_config
from nisar_pipeline.discover import Product
from nisar_pipeline.grid import make_grid
from nisar_pipeline.gunw import GunwSubset, SubsetError, read_subset, resample
from nisar_pipeline.nisar import build_series
from nisar_pipeline.timeseries import (
    SIGN,
    coherence_invalid,
    invert_network,
    phase_to_los_cm,
    subtract_reference,
)

from .gunw_fixture import CENTER_FREQ, product_axes, write_gunw
from .test_config import ROOT

BBOX = (-115.65, 32.20, -115.00, 32.75)
GRID = make_grid(BBOX, "EPSG:32611", 48)


# ---------- gunw.py ----------

def test_read_subset_window_and_metadata(tmp_path):
    x, y = product_axes(GRID, margin_m=40_000)
    phase = np.ones((y.size, x.size), np.float32)
    path = write_gunw(tmp_path / "p.h5", x, y, phase, np.full_like(phase, 0.9))
    with h5py.File(path) as f:
        sub = read_subset(f, GRID)
    # la ventana es mucho menor que el producto completo
    assert sub.phase.shape[1] < x.size * 0.75
    assert sub.x.min() <= GRID.bounds[0] and sub.x.max() >= GRID.bounds[2]
    assert sub.wavelength_m == pytest.approx(299_792_458 / CENTER_FREQ)
    assert (sub.ref_date, sub.sec_date) == ("2025-10-29", "2025-11-22")
    assert sub.epsg == 32611


def test_read_subset_rejects_non_overlapping(tmp_path):
    x = np.arange(0, 8000, 80.0)
    y = np.arange(9e6, 9e6 - 8000, -80.0)
    p = np.zeros((y.size, x.size))
    path = write_gunw(tmp_path / "p.h5", x, y, p, p)
    with h5py.File(path) as f, pytest.raises(SubsetError):
        read_subset(f, GRID)


def test_resample_preserves_field_and_orientation(tmp_path):
    x, y = product_axes(GRID)
    xx, yy = np.meshgrid(x, y)
    field = ((yy - yy.min()) / 1000).astype(np.float32)  # crece hacia el norte
    path = write_gunw(tmp_path / "p.h5", x, y, field, np.ones_like(field))
    with h5py.File(path) as f:
        sub = read_subset(f, GRID)
    out = resample(sub, sub.phase, GRID)
    assert out.shape == (GRID.height, GRID.width)
    assert np.isfinite(out).all()
    assert out[0].mean() > out[-1].mean()  # fila 0 = norte

    # y ascendente (sur -> norte) también se maneja
    flipped = GunwSubset(sub.phase[::-1], sub.coherence, sub.ionosphere, sub.x, sub.y[::-1],
                         sub.epsg, sub.wavelength_m, sub.ref_date, sub.sec_date)
    np.testing.assert_allclose(resample(flipped, flipped.phase, GRID), out, atol=1e-4)


def test_subset_cache_roundtrip(tmp_path):
    x, y = product_axes(GRID)
    p = np.random.default_rng(0).random((y.size, x.size)).astype(np.float32)
    with h5py.File(write_gunw(tmp_path / "p.h5", x, y, p, p)) as f:
        sub = read_subset(f, GRID)
    sub.save(tmp_path / "s.npz")
    back = GunwSubset.load(tmp_path / "s.npz")
    np.testing.assert_array_equal(back.phase, sub.phase)
    assert back.ref_date == sub.ref_date and back.epsg == sub.epsg


# ---------- timeseries.py ----------

def test_sign_convention_fixed():
    """Convención fijada: fase positiva -> desplazamiento negativo (alejamiento = hundimiento)."""
    assert SIGN == -1.0
    lam = 0.2384
    d = phase_to_los_cm(np.array([2 * np.pi], np.float32), lam)
    assert d[0] == pytest.approx(-lam / 2 * 100)


def test_invert_recovers_known_series_chain_and_redundant():
    truth = np.array([0.0, -1.0, -2.5, -3.0, -4.2], np.float32)
    h = w = 3
    pairs = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 2), (2, 4)]
    ifgs = np.stack([np.full((h, w), truth[j] - truth[i]) for i, j in pairs])
    cube = invert_network(pairs, ifgs, 5)
    assert (cube[0] == 0).all()
    np.testing.assert_allclose(cube[:, 1, 1], truth, atol=1e-5)


def test_invert_nodata_when_network_breaks():
    pairs = [(0, 1), (1, 2), (2, 3)]
    ifgs = np.ones((3, 2, 2), np.float32)
    ifgs[1, 0, 0] = np.nan  # rompe la cadena en un píxel
    cube = invert_network(pairs, ifgs, 4)
    assert np.isnan(cube[:, 0, 0]).all()
    np.testing.assert_allclose(cube[:, 1, 1], [0, 1, 2, 3])


def test_reference_and_coherence_mask():
    ifg = np.full((4, 4), 5.0, np.float32)
    ref = np.zeros((4, 4), bool)
    ref[:3, :3] = True
    assert (subtract_reference(ifg, ref) == 0).all()
    with pytest.raises(RuntimeError):
        subtract_reference(np.full((4, 4), np.nan, np.float32), ref)
    coh = np.full((2, 2, 2), 0.8, np.float32)
    coh[:, 0, 0] = 0.1
    coh[:, 1, 1] = np.nan
    assert coherence_invalid(coh, 0.3).tolist() == [[True, False], [False, True]]


# ---------- integración: HDF5 sintéticos -> cubo ----------

def test_build_series_from_synthetic_gunws(tmp_path):
    cfg = load_config(ROOT / "regions.yaml")
    layer = cfg.regions[0].layers[0]
    lam = 299_792_458 / CENTER_FREQ
    x, y = product_axes(GRID)
    xx, yy = np.meshgrid(x, y)
    cx, cy = GRID.west + GRID.width * GRID.cell * 0.6, GRID.north - GRID.height * GRID.cell * 0.6
    bowl = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * 5000.0**2)))  # 0..1
    dates = [date(2025, 10, 29), date(2025, 11, 22), date(2025, 12, 4)]
    step_cm = -2.0  # hundimiento por intervalo en el centro
    subs = []
    for k in range(2):
        los_cm = step_cm * bowl
        phase = (los_cm / 100) * (4 * np.pi) / lam / SIGN + 7.0  # offset arbitrario
        iono = np.full_like(phase, 0.5)
        path = write_gunw(tmp_path / f"{k}.h5", x, y, (phase + iono).astype(np.float32),
                          np.full_like(phase, 0.9), iono.astype(np.float32),
                          ref=dates[k].isoformat(), sec=dates[k + 1].isoformat())
        with h5py.File(path) as f:
            subs.append(read_subset(f, GRID))
    cube = build_series(subs, dates, GRID, layer)
    assert cube.shape == (3, GRID.height, GRID.width)
    assert np.nanmax(np.abs(cube[0])) == 0
    # el mínimo de la última fecha ~ -4 cm (dos intervalos) en el centro del cuenco
    assert np.nanmin(cube[-1]) == pytest.approx(2 * step_cm, abs=0.3)


def test_product_dataclass_is_hashable():
    p = Product("id", "u", "2025-01-01", "2025-01-13", 5, 18, "A", "x", 1, True)
    assert {p}
