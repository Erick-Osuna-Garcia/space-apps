"""Fase -> desplazamiento LOS y serie de tiempo acumulada (SBAS simplificado)."""

from __future__ import annotations

import warnings

import numpy as np

# d_LOS = SIGN * λ/(4π) * φ. Con SIGN = -1, un valor negativo significa que el suelo se aleja
# del satélite (hundimiento). La convención se fija en tests/test_timeseries.py y se validó
# empíricamente con Cerro Prieto (ver pipeline/README.md).
SIGN = -1.0


class ReferenceError_(RuntimeError):
    pass


def phase_to_los_cm(phase_rad: np.ndarray, wavelength_m: float) -> np.ndarray:
    return (SIGN * wavelength_m / (4 * np.pi) * phase_rad * 100.0).astype(np.float32)


def subtract_reference(ifg: np.ndarray, ref_mask: np.ndarray) -> np.ndarray:
    """Resta la mediana de la zona estable (quita el offset arbitrario de la fase desenvuelta)."""
    vals = ifg[ref_mask]
    vals = vals[np.isfinite(vals)]
    if vals.size < 5:
        raise ReferenceError_("La zona de referencia no tiene píxeles válidos en un interferograma")
    return ifg - np.float32(np.median(vals))


def coherence_invalid(coherence: np.ndarray, threshold: float) -> np.ndarray:
    """(N, H, W) -> máscara (H, W) True donde la coherencia media es menor al umbral."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # píxeles sin ningún valor -> NaN
        mean = np.nanmean(coherence, axis=0)
    return ~(mean >= threshold)


def invert_network(pairs: list[tuple[int, int]], ifgs: np.ndarray, n_dates: int) -> np.ndarray:
    """Mínimos cuadrados por píxel sobre la red de pares.

    pairs[k] = (i, j) con i < j índices de fecha; ifgs[k] = d(j) - d(i).
    Devuelve (n_dates, H, W) con d(0) = 0; NaN donde la red válida no conecta todas las fechas.
    """
    n, h, w = ifgs.shape
    if n != len(pairs):
        raise ValueError("pairs e ifgs no coinciden")
    a = np.zeros((n, n_dates - 1), dtype=np.float64)
    for k, (i, j) in enumerate(pairs):
        if not 0 <= i < j < n_dates:
            raise ValueError(f"par inválido {(i, j)}")
        a[k, i:j] = 1.0

    flat = ifgs.reshape(n, -1)
    valid = np.isfinite(flat)
    out = np.full((n_dates, h * w), np.nan, dtype=np.float32)
    patterns, inverse = np.unique(valid.T, axis=0, return_inverse=True)
    for p_idx, pattern in enumerate(patterns):
        if not pattern.any():
            continue
        sub_a = a[pattern]
        if np.linalg.matrix_rank(sub_a) < n_dates - 1:
            continue  # la red válida no conecta todas las fechas en estos píxeles
        pix = np.nonzero(inverse.ravel() == p_idx)[0]
        inc, *_ = np.linalg.lstsq(sub_a, flat[pattern][:, pix].astype(np.float64), rcond=None)
        out[0, pix] = 0.0
        out[1:, pix] = np.cumsum(inc, axis=0)
    return out.reshape(n_dates, h, w)
