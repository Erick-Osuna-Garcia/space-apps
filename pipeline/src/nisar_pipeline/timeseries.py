"""Fase -> desplazamiento LOS y serie de tiempo acumulada (SBAS simplificado)."""

from __future__ import annotations

import warnings

import numpy as np

# d_LOS = SIGN * λ/(4π) * φ. Con SIGN = -1, un valor negativo significa que el suelo se aleja
# del satélite (hundimiento). La especificación del producto no define el signo: se validó con
# datos reales (2026-11), donde el campo de Cerro Prieto sale negativo. Ver pipeline/README.md.
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


def velocity_from_cube(cube: np.ndarray, dates) -> np.ndarray:
    """Tendencia lineal (cm/año) por píxel; NaN con menos de 2 fechas válidas."""
    years = np.array([(d - dates[0]).days / 365.25 for d in dates], dtype=np.float64)
    valid = np.isfinite(cube)
    n = valid.sum(axis=0)
    x = np.where(valid, years[:, None, None], 0.0)
    y = np.where(valid, cube, 0.0).astype(np.float64)
    sx, sy = x.sum(axis=0), y.sum(axis=0)
    den = n * (x * x).sum(axis=0) - sx * sx
    with np.errstate(invalid="ignore", divide="ignore"):
        out = (n * (x * y).sum(axis=0) - sx * sy) / den
    out[(n < 2) | (den == 0)] = np.nan
    return out.astype(np.float32)


def deramp(ifg: np.ndarray, fit_mask: np.ndarray) -> np.ndarray:
    """Quita un plano ajustado en `fit_mask`: elimina la rampa de atmósfera, ionosfera y órbita."""
    h, w = ifg.shape
    yy, xx = np.mgrid[0:h, 0:w]
    m = fit_mask & np.isfinite(ifg)
    if m.sum() < 100:
        return ifg
    a = np.c_[xx[m] / w, yy[m] / h, np.ones(m.sum())]
    coef, *_ = np.linalg.lstsq(a, ifg[m].astype(np.float64), rcond=None)
    return (ifg - (coef[0] * xx / w + coef[1] * yy / h + coef[2])).astype(np.float32)


def fill_network_gaps(
    pairs: list[tuple[int, int]], ifgs: np.ndarray, dates, min_valid: float = 0.7
) -> tuple[list[tuple[int, int]], np.ndarray]:
    """Completa la red con la velocidad media del píxel para que una falta no lo descarte.

    Agrega pares puente entre fechas consecutivas sin conexión y rellena los huecos de píxeles
    con al menos `min_valid` de pares válidos; los demás quedan NaN.
    """
    days = np.array([(dates[j] - dates[i]).days for i, j in pairs], dtype=np.float32)
    covered = np.zeros(len(dates) - 1, dtype=bool)
    for i, j in pairs:
        covered[i:j] = True
    valid = np.isfinite(ifgs)
    total = np.where(valid, ifgs, 0).sum(axis=0)
    span = (valid * days[:, None, None]).sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        rate = total / span  # cm/día
    enough = valid.mean(axis=0) >= min_valid

    bridges = [(k, k + 1) for k in np.nonzero(~covered)[0].tolist()]
    all_pairs = pairs + bridges
    extra = [rate * (dates[j] - dates[i]).days for i, j in bridges]
    out = np.concatenate([ifgs, np.stack(extra)]) if extra else ifgs.copy()
    all_days = np.array([(dates[j] - dates[i]).days for i, j in all_pairs], dtype=np.float32)
    fill = rate[None] * all_days[:, None, None]
    out = np.where(np.isfinite(out), out, fill)
    out[:, ~enough] = np.nan
    return all_pairs, out.astype(np.float32)


def smooth_series(cube: np.ndarray, window: int = 5) -> np.ndarray:
    """Media móvil en el tiempo (quita ruido atmosférico por fecha) con d(0) = 0."""
    t = cube.shape[0]
    half = min(window // 2, (t - 1) // 4)  # en series cortas la ventana aplanaría la señal
    out = np.empty_like(cube)
    for k in range(t):
        out[k] = cube[max(0, k - half) : min(t, k + half + 1)].mean(axis=0)
    return out - out[0]


def decompose(
    v_a: np.ndarray, e_a: np.ndarray, u_a: np.ndarray,
    v_d: np.ndarray, e_d: np.ndarray, u_d: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Velocidad vertical y este desde dos órbitas, ignorando el norte (sensibilidad baja).

    v = e·este + u·vertical, con (e, u) los componentes del vector suelo→satélite.
    """
    det = e_a * u_d - e_d * u_a
    with np.errstate(invalid="ignore", divide="ignore"):
        east = (v_a * u_d - v_d * u_a) / det
        up = (e_a * v_d - e_d * v_a) / det
    return up.astype(np.float32), east.astype(np.float32)


def reject_outliers(
    cube: np.ndarray, block: int = 16, max_diff_cm: float = 8.0, max_abs_cm: float = 30.0
) -> np.ndarray:
    """Marca sin dato los píxeles que se separan de su entorno: errores de desenvolvimiento.

    Un salto de fase en una parcela suelta da decenas de cm imposibles en un año, mientras que la
    deformación real es suave. Se compara la última fecha con la mediana por bloques.
    """
    last = cube[-1]
    h, w = last.shape
    local = np.full_like(last, np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for j in range(0, h, block):
            for i in range(0, w, block):
                local[j : j + block, i : i + block] = np.nanmedian(
                    last[j : j + block, i : i + block]
                )
    with np.errstate(invalid="ignore"):
        bad = (np.abs(last - local) > max_diff_cm) | (np.nanmax(np.abs(cube), axis=0) > max_abs_cm)
    out = cube.copy()
    out[:, bad] = np.nan
    return out
