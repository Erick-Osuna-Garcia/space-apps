from datetime import date

import h5py
import numpy as np
import pytest

from nisar_pipeline.config import load_config
from nisar_pipeline.discover import Product
from nisar_pipeline.grid import make_grid
from nisar_pipeline.gunw import (
    GunwSubset,
    SubsetError,
    main_component_mask,
    read_subset,
    resample,
)
from nisar_pipeline.nisar import build_series
from nisar_pipeline.timeseries import (
    SIGN,
    coherence_invalid,
    decompose,
    deramp,
    fill_network_gaps,
    invert_network,
    phase_to_los_cm,
    reject_outliers,
    smooth_series,
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
    flipped = GunwSubset(sub.phase[::-1], sub.coherence, sub.ionosphere, sub.components,
                         sub.x, sub.y[::-1],
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


def test_main_component_mask_keeps_largest():
    comp = np.array([[0, 1, 1], [2, 2, 2], [2, 0, 1]], dtype=np.uint16)
    mask = main_component_mask(comp)
    assert mask.sum() == 4 and mask[1].all()
    assert not main_component_mask(np.zeros((2, 2), np.uint16)).any()


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


def test_decompose_recovers_known_motion():
    east, up = 2.0, -5.0
    e_a, u_a, e_d, u_d = -0.6, 0.78, 0.6, 0.78
    v_a = np.array([e_a * east + u_a * up], np.float32)
    v_d = np.array([e_d * east + u_d * up], np.float32)
    got_up, got_east = decompose(
        v_a, np.array([e_a]), np.array([u_a]), v_d, np.array([e_d]), np.array([u_d])
    )
    assert got_up[0] == pytest.approx(up, abs=1e-3)
    assert got_east[0] == pytest.approx(east, abs=1e-3)


def test_decompose_needs_both_geometries():
    up, east = decompose(
        np.array([np.nan], np.float32), np.array([-0.6]), np.array([0.78]),
        np.array([1.0], np.float32), np.array([0.6]), np.array([0.78]),
    )
    assert np.isnan(up[0]) and np.isnan(east[0])


def test_reject_outliers_drops_jumps_keeps_smooth_bowl():
    yy, xx = np.mgrid[0:64, 0:64]
    bowl = (-10 * np.exp(-((xx - 32) ** 2 + (yy - 32) ** 2) / (2 * 15.0**2))).astype(np.float32)
    cube = np.stack([bowl * 0, bowl])
    cube[1, 5, 5] = -60     # salto de fase
    cube[1, 40, 10] = 25    # salto de fase
    out = reject_outliers(cube)
    assert np.isnan(out[1, 5, 5]) and np.isnan(out[1, 40, 10])
    assert out[1, 32, 32] == pytest.approx(-10, abs=0.01)
    assert np.isfinite(out[1]).mean() > 0.99


def test_deramp_removes_plane_keeps_local_signal():
    yy, xx = np.mgrid[0:40, 0:40]
    ramp = (0.1 * xx + 0.05 * yy).astype(np.float32)
    ifg = ramp.copy()
    ifg[18:22, 18:22] -= 5
    mask = np.ones(ifg.shape, bool)
    mask[14:26, 14:26] = False
    out = deramp(ifg, mask)
    assert abs(out[0, 0]) < 0.01
    assert out[20, 20] == pytest.approx(-5, abs=0.05)


def test_fill_network_gaps_bridges_and_fills():
    dates = [date(2025, 1, 1), date(2025, 1, 13), date(2025, 1, 25), date(2025, 2, 6), date(2025, 2, 18)]
    pairs = [(0, 1), (1, 2), (3, 4)]  # falta 2 -> 3
    ifgs = np.full((3, 1, 2), -1.2, np.float32)  # 0.1 cm/día
    ifgs[1, 0, 1] = np.nan
    all_pairs, out = fill_network_gaps(pairs, ifgs, dates, min_valid=0.6)
    assert all_pairs[-1] == (2, 3)
    assert out[1, 0, 1] == pytest.approx(-1.2)
    assert out[3, 0, 0] == pytest.approx(-1.2)
    cube = invert_network(all_pairs, out, 5)
    assert cube[-1, 0, 0] == pytest.approx(-4.8)


def test_fill_network_gaps_drops_poor_pixels():
    dates = [date(2025, 1, 1), date(2025, 1, 13), date(2025, 1, 25)]
    ifgs = np.array([[[1.0]], [[np.nan]]], np.float32)
    _, out = fill_network_gaps([(0, 1), (1, 2)], ifgs, dates, min_valid=0.7)
    assert np.isnan(out).all()


def test_smooth_series_starts_at_zero_and_reduces_noise():
    t = np.arange(21, dtype=np.float32)
    noisy = (-t + np.where(t % 2 == 0, 2, -2))[:, None, None]
    s = smooth_series(noisy, 5)
    assert (s[0] == 0).all()
    assert np.abs(np.diff(s[:, 0, 0])).std() < np.abs(np.diff(noisy[:, 0, 0])).std()


# ---------- integración: HDF5 sintéticos -> cubo ----------

def test_build_series_from_synthetic_gunws(tmp_path):
    cfg = load_config(ROOT / "regions.yaml")
    layer = cfg.regions[0].layers[0].model_copy(update={"ionosphere_correction": True})
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
    assert np.nanmin(cube[-1]) < 1.5 * step_cm


def test_product_dataclass_is_hashable():
    p = Product("id", "u", "2025-01-01", "2025-01-13", 5, 18, "A", "x", 1, True)
    assert {p}
