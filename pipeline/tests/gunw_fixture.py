"""HDF5 mínimo con la estructura de NISAR L2 GUNW para tests."""

from __future__ import annotations

from pathlib import Path

import h5py
import numpy as np

from nisar_pipeline.gunw import PATHS

CENTER_FREQ = 1.2575e9  # Hz -> λ ≈ 0.2384 m


def write_gunw(
    path: Path, x: np.ndarray, y: np.ndarray, phase: np.ndarray, coherence: np.ndarray,
    ionosphere: np.ndarray | None = None, ref="2025-10-29", sec="2025-11-22",
    epsg=32611, pol="HH",
) -> Path:
    with h5py.File(path, "w") as f:
        f[PATHS["x"]] = x
        f[PATHS["y"]] = y
        f[PATHS["projection"]] = np.uint32(epsg)
        f[PATHS["projection"]].attrs["epsg_code"] = epsg
        f[PATHS["center_frequency"]] = CENTER_FREQ
        f[PATHS["ref_time"]] = np.bytes_(f"{ref}T12:51:10.000000000")
        f[PATHS["sec_time"]] = np.bytes_(f"{sec}T12:51:10.000000000")
        f.create_dataset(PATHS["phase"].format(pol=pol), data=phase.astype(np.float32), chunks=True)
        f.create_dataset(PATHS["coherence"].format(pol=pol), data=coherence.astype(np.float32), chunks=True)
        iono = ionosphere if ionosphere is not None else np.zeros_like(phase)
        f.create_dataset(PATHS["ionosphere"].format(pol=pol), data=iono.astype(np.float32), chunks=True)
    return path


def product_axes(grid, margin_m=5_000.0, step=80.0):
    min_x, min_y, max_x, max_y = grid.bounds
    x = np.arange(min_x - margin_m, max_x + margin_m, step) + step / 2
    y = np.arange(max_y + margin_m, min_y - margin_m, -step) - step / 2  # norte -> sur
    return x, y
