"""Terreno: Copernicus DEM GLO-30 (AWS Open Data, sin credenciales) remuestreado a la grilla de la región."""

from __future__ import annotations

import logging
import math
from collections.abc import Callable, Iterable

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.warp import Resampling, reproject

from .config import BBox
from .grid import Grid

log = logging.getLogger(__name__)

COPERNICUS_BASE = "https://copernicus-dem-30m.s3.amazonaws.com"


def copernicus_tile_url(lat_floor: int, lon_floor: int) -> str:
    ns = "N" if lat_floor >= 0 else "S"
    ew = "E" if lon_floor >= 0 else "W"
    name = f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"
    return f"/vsicurl/{COPERNICUS_BASE}/{name}/{name}.tif"


def tiles_for_grid(grid: Grid) -> list[tuple[int, int]]:
    """Teselas de 1° que tocan la envolvente proyectada (que puede salirse un poco del bbox WGS84)."""
    corners = grid.corner_lonlat().values()
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    return tiles_for_bbox((min(lons), min(lats), max(lons), max(lats)))


def tiles_for_bbox(bbox: BBox) -> list[tuple[int, int]]:
    min_lon, min_lat, max_lon, max_lat = bbox
    return [
        (lat, lon)
        for lat in range(math.floor(min_lat), math.ceil(max_lat))
        for lon in range(math.floor(min_lon), math.ceil(max_lon))
    ]


def load_dem(
    grid: Grid,
    tile_url: Callable[[int, int], str] = copernicus_tile_url,
    tiles: Iterable[tuple[int, int]] | None = None,
) -> np.ndarray:
    """Devuelve alturas (float32, m) de forma (height, width) alineadas a `grid`.

    Las celdas sin cobertura (mar abierto: Copernicus no publica esas teselas) quedan en 0 m.
    """
    out = np.full((grid.height, grid.width), np.nan, dtype=np.float32)
    found = 0
    for lat, lon in tiles if tiles is not None else tiles_for_grid(grid):
        url = tile_url(lat, lon)
        try:
            with rasterio.open(url) as src:
                dst = np.full_like(out, np.nan)
                reproject(
                    source=rasterio.band(src, 1),
                    destination=dst,
                    dst_transform=grid.transform,
                    dst_crs=grid.crs,
                    dst_nodata=np.nan,
                    resampling=Resampling.bilinear,
                )
        except RasterioIOError:
            log.info("Tesela DEM no disponible (probablemente mar): %s", url)
            continue
        found += 1
        mask = np.isfinite(dst)
        out[mask] = dst[mask]
    if found == 0:
        raise RuntimeError(f"No se encontró ninguna tesela DEM para la grilla {grid.bounds}")
    return np.nan_to_num(out, nan=0.0)
