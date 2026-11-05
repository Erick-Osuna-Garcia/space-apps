"""Capa de subsidencia sintética (desarrollo): cuenco gaussiano centrado en Cerro Prieto.

NO son mediciones. El manifiesto marca estas capas con source="synthetic" y la web lo avisa.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from .grid import Grid

PEAK_RATE_CM_YR = -12.0  # orden de magnitud publicado para Cerro Prieto
SIGMA_MAJOR_M = 6_000.0
SIGMA_MINOR_M = 3_500.0
ROTATION_DEG = 40.0  # eje mayor NE-SO, aprox. la tendencia del campo
SEASONAL_CM = 0.4
NOISE_CM = 0.25
ACCEL_CM_YR2 = -2.0  # parte del cuenco se acelera, para poder probar la vista Aceleración
ACCEL_OFFSET_M = 2_500.0
ACCEL_SIGMA_M = 3_000.0
STEP_DAYS = 24  # 2 ciclos de repetición de NISAR (12 días)


def synthetic_dates(start: date, end: date, step_days: int = STEP_DAYS) -> list[date]:
    out, d = [], start
    while d <= end:
        out.append(d)
        d += timedelta(days=step_days)
    return out


def synthetic_subsidence(
    grid: Grid, center_colrow: tuple[float, float], dates: list[date], seed: int = 2026
) -> np.ndarray:
    """Cubo (T, H, W) de desplazamiento LOS acumulado en cm; NaN = baja coherencia."""
    rng = np.random.default_rng(seed)
    cols = (np.arange(grid.width) + 0.5 - center_colrow[0]) * grid.cell
    rows = (np.arange(grid.height) + 0.5 - center_colrow[1]) * grid.cell
    x, y = np.meshgrid(cols, -rows)  # y hacia el norte
    th = np.deg2rad(ROTATION_DEG)
    u = x * np.cos(th) + y * np.sin(th)
    v = -x * np.sin(th) + y * np.cos(th)
    rate = PEAK_RATE_CM_YR * np.exp(-0.5 * ((u / SIGMA_MAJOR_M) ** 2 + (v / SIGMA_MINOR_M) ** 2))

    accel = ACCEL_CM_YR2 * np.exp(
        -0.5 * (((u - ACCEL_OFFSET_M) ** 2 + v**2) / ACCEL_SIGMA_M**2)
    )

    # Parches de baja coherencia (agua, vegetación densa): umbral sobre ruido suavizado.
    blobs = _smooth_noise(rng, grid.height, grid.width, scale=max(4, grid.width // 24))
    nodata = blobs > np.quantile(blobs, 0.94)

    t0 = dates[0]
    cube = np.empty((len(dates), grid.height, grid.width), dtype=np.float32)
    for i, d in enumerate(dates):
        years = (d - t0).days / 365.25
        if i == 0:
            cube[i] = 0.0
            continue
        seasonal = SEASONAL_CM * np.sin(2 * np.pi * years)
        noise = rng.normal(0.0, NOISE_CM, size=rate.shape)
        cube[i] = rate * years + accel * years**2 + seasonal * (rate / PEAK_RATE_CM_YR) + noise
    cube[:, nodata] = np.nan
    return cube


def _smooth_noise(rng: np.random.Generator, h: int, w: int, scale: int) -> np.ndarray:
    coarse = rng.random((h // scale + 2, w // scale + 2))
    yi = np.linspace(0, coarse.shape[0] - 1.001, h)
    xi = np.linspace(0, coarse.shape[1] - 1.001, w)
    y0, x0 = yi.astype(int), xi.astype(int)
    fy, fx = (yi - y0)[:, None], (xi - x0)[None, :]
    a = coarse[np.ix_(y0, x0)]
    b = coarse[np.ix_(y0, x0 + 1)]
    c = coarse[np.ix_(y0 + 1, x0)]
    d = coarse[np.ix_(y0 + 1, x0 + 1)]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
