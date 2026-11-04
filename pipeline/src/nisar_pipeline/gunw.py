"""Lectura de recortes de NISAR L2 GUNW (HDF5) y remuestreo a la grilla de la región.

Rutas según JPL D-102272 Rev E (NISAR L2 GUNW Product Specification, v1.2.1).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
from pyproj import Transformer
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject

from .grid import Grid

SPEED_OF_LIGHT = 299_792_458.0

UNW = "/science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram"
PATHS = {
    "x": f"{UNW}/xCoordinates",
    "y": f"{UNW}/yCoordinates",
    "projection": f"{UNW}/projection",
    "center_frequency": "/science/LSAR/GUNW/grids/frequencyA/centerFrequency",
    "ref_time": "/science/LSAR/identification/referenceZeroDopplerStartTime",
    "sec_time": "/science/LSAR/identification/secondaryZeroDopplerStartTime",
    # por polarización (HH o VV)
    "phase": UNW + "/{pol}/unwrappedPhase",
    "coherence": UNW + "/{pol}/coherenceMagnitude",
    "ionosphere": UNW + "/{pol}/ionospherePhaseScreen",
}


class SubsetError(RuntimeError):
    pass


@dataclass
class GunwSubset:
    phase: np.ndarray  # rad, (rows, cols), NaN = sin dato
    coherence: np.ndarray
    ionosphere: np.ndarray  # rad
    x: np.ndarray  # centros de píxel (m)
    y: np.ndarray
    epsg: int
    wavelength_m: float
    ref_date: str
    sec_date: str

    def save(self, path: Path) -> None:
        """Escritura atómica: el archivo final solo existe si está completo."""
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp.npz")
        np.savez_compressed(
            tmp, phase=self.phase, coherence=self.coherence, ionosphere=self.ionosphere,
            x=self.x, y=self.y, epsg=self.epsg, wavelength_m=self.wavelength_m,
            ref_date=self.ref_date, sec_date=self.sec_date,
        )
        tmp.replace(path)

    @classmethod
    def load(cls, path: Path) -> GunwSubset:
        with np.load(path) as z:
            return cls(
                phase=z["phase"], coherence=z["coherence"], ionosphere=z["ionosphere"],
                x=z["x"], y=z["y"], epsg=int(z["epsg"]), wavelength_m=float(z["wavelength_m"]),
                ref_date=str(z["ref_date"]), sec_date=str(z["sec_date"]),
            )


def _str(v) -> str:
    v = v[()] if hasattr(v, "shape") else v
    return v.decode() if isinstance(v, bytes) else str(v)


def _window(coords: np.ndarray, lo: float, hi: float, margin: int) -> slice:
    idx = np.nonzero((coords >= lo) & (coords <= hi))[0]
    if idx.size == 0:
        return slice(0, 0)
    return slice(max(0, idx[0] - margin), min(coords.size, idx[-1] + 1 + margin))


def read_subset(f: h5py.File, grid: Grid, pol: str = "HH", margin_px: int = 3) -> GunwSubset:
    """Lee solo la ventana que cubre la grilla (h5py lee por chunks; remoto = pocas peticiones)."""
    x = f[PATHS["x"]][()]
    y = f[PATHS["y"]][()]
    epsg = int(f[PATHS["projection"]][()])
    min_x, min_y, max_x, max_y = grid.bounds
    if f"EPSG:{epsg}" != grid.crs:
        tr = Transformer.from_crs(grid.crs, f"EPSG:{epsg}", always_xy=True)
        min_x, min_y, max_x, max_y = tr.transform_bounds(min_x, min_y, max_x, max_y)
    cols = _window(x, min_x, max_x, margin_px)
    rows = _window(y, min_y, max_y, margin_px)
    if cols.stop - cols.start < 2 or rows.stop - rows.start < 2:
        raise SubsetError("El producto no cubre la grilla de la región")

    def band(key: str) -> np.ndarray:
        return np.asarray(f[PATHS[key].format(pol=pol)][rows, cols], dtype=np.float32)

    return GunwSubset(
        phase=band("phase"),
        coherence=band("coherence"),
        ionosphere=band("ionosphere"),
        x=x[cols].astype(np.float64),
        y=y[rows].astype(np.float64),
        epsg=epsg,
        wavelength_m=SPEED_OF_LIGHT / float(f[PATHS["center_frequency"]][()]),
        ref_date=_str(f[PATHS["ref_time"]])[:10],
        sec_date=_str(f[PATHS["sec_time"]])[:10],
    )


def resample(sub: GunwSubset, arr: np.ndarray, grid: Grid) -> np.ndarray:
    """Remuestrea una banda del recorte a la grilla (promedio: la grilla es más gruesa que 80 m)."""
    x, y, data = sub.x, sub.y, arr
    if y.size > 1 and y[1] > y[0]:  # filas de sur a norte -> voltear
        y, data = y[::-1], data[::-1]
    dx = float(x[1] - x[0])
    dy = float(y[0] - y[1])
    src_transform = from_origin(x[0] - dx / 2, y[0] + dy / 2, dx, dy)
    out = np.full((grid.height, grid.width), np.nan, dtype=np.float32)
    reproject(
        source=np.ascontiguousarray(data, dtype=np.float32),
        destination=out,
        src_transform=src_transform,
        src_crs=f"EPSG:{sub.epsg}",
        src_nodata=np.nan,
        dst_transform=grid.transform,
        dst_crs=grid.crs,
        dst_nodata=np.nan,
        resampling=Resampling.average if dx < grid.cell else Resampling.bilinear,
    )
    return out
