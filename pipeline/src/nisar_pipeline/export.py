"""Escritura de assets web: binarios Int16 LE planos + manifest.json, con presupuesto de tamaño."""

from __future__ import annotations

import logging
import math
from pathlib import Path

import numpy as np

from .grid import Grid
from .manifest import Manifest

log = logging.getLogger(__name__)

NODATA = -32768
INT16_MAX = 32767
MIN_GRID_SIDE = 64


class BudgetError(RuntimeError):
    pass


def bytes_needed(grid: Grid, n_dates: int) -> int:
    """Terreno (1 banda) + cubo de cada capa (n_dates bandas), Int16."""
    return grid.width * grid.height * 2 * (1 + n_dates)


def fit_grid_to_budget(grid: Grid, n_dates: int, budget_bytes: int, region_id: str) -> Grid:
    """Reduce la resolución de la grilla hasta que los assets quepan en el presupuesto."""
    needed = bytes_needed(grid, n_dates)
    if needed <= budget_bytes:
        return grid
    factor = math.sqrt(needed / budget_bytes) * 1.01
    fitted = grid.coarsened(factor)
    while (
        bytes_needed(fitted, n_dates) > budget_bytes
        and max(fitted.width, fitted.height) >= MIN_GRID_SIDE
    ):
        side = max(fitted.width, fitted.height)
        fitted = fitted.coarsened(side / (side - 1))
    if (
        max(fitted.width, fitted.height) < MIN_GRID_SIDE
        or bytes_needed(fitted, n_dates) > budget_bytes
    ):
        raise BudgetError(
            f"{region_id}: {needed / 1e6:.1f} MB no caben en {budget_bytes / 1e6:.1f} MB "
            f"sin bajar de {MIN_GRID_SIDE} celdas por lado"
        )
    log.warning(
        "%s: %.1f MB exceden el presupuesto de %.1f MB; grilla %dx%d -> %dx%d",
        region_id, needed / 1e6, budget_bytes / 1e6,
        grid.width, grid.height, fitted.width, fitted.height,
    )
    return fitted


def encode_terrain(dem_m: np.ndarray) -> np.ndarray:
    return np.clip(np.rint(dem_m), -INT16_MAX, INT16_MAX).astype("<i2")


def encode_cube(cube_cm: np.ndarray) -> np.ndarray:
    """(T, H, W) en cm float con NaN = sin dato -> Int16 en mm con NODATA."""
    mm = np.rint(cube_cm * 10.0)
    out = np.clip(np.nan_to_num(mm, nan=0.0), -INT16_MAX, INT16_MAX).astype("<i2")
    out[~np.isfinite(cube_cm)] = NODATA
    return out


def decode_cube(raw: bytes, n_dates: int, height: int, width: int) -> np.ndarray:
    arr = np.frombuffer(raw, dtype="<i2").reshape(n_dates, height, width)
    out = arr.astype(np.float32) / 10.0
    out[arr == NODATA] = np.nan
    return out


def write_bin(path: Path, arr: np.ndarray) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    dtype = np.uint8 if arr.dtype == np.uint8 else "<i2"
    data = np.ascontiguousarray(arr, dtype=dtype).tobytes()
    path.write_bytes(data)
    return len(data)


def check_budget(region_id: str, total_bytes: int, budget_bytes: int) -> None:
    if total_bytes > budget_bytes:
        raise BudgetError(
            f"{region_id}: assets de {total_bytes / 1e6:.2f} MB exceden {budget_bytes / 1e6:.2f} MB"
        )


def write_manifest(out_dir: Path, manifest: Manifest) -> Path:
    """Valida el manifiesto y que cada ruta referida exista antes de escribirlo."""
    manifest = Manifest.model_validate(manifest.model_dump())
    missing = [
        p
        for r in manifest.regions
        for p in [
            r.terrain.path,
            *(layer.path for layer in r.layers),
            *(o.path for o in r.overlays),
            *([r.events] if r.events else []),
        ]
        if not (out_dir / p).is_file()
    ]
    if missing:
        raise FileNotFoundError(f"El manifiesto refiere archivos inexistentes: {missing}")
    path = out_dir / "manifest.json"
    path.write_text(manifest.model_dump_json(indent=2) + "\n", encoding="utf-8")
    return path
