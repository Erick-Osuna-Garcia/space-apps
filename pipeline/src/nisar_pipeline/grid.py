"""Grilla regular en proyección métrica (UTM) compartida por terreno y capas de una región."""

from __future__ import annotations

import math
from dataclasses import dataclass, replace

from pyproj import Transformer
from rasterio.transform import Affine, from_origin

from .config import BBox


@dataclass(frozen=True)
class Grid:
    crs: str
    west: float  # x del borde izquierdo (m)
    north: float  # y del borde superior (m)
    cell: float  # tamaño de celda (m)
    width: int
    height: int

    @property
    def transform(self) -> Affine:
        return from_origin(self.west, self.north, self.cell, self.cell)

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """(minX, minY, maxX, maxY) en metros."""
        return (
            self.west,
            self.north - self.height * self.cell,
            self.west + self.width * self.cell,
            self.north,
        )

    def lonlat_to_colrow(self, lon: float, lat: float) -> tuple[float, float]:
        """Coordenadas de grilla fraccionarias (col, row); (0,0) es la esquina NO de la celda NO."""
        x, y = _to_proj(self.crs).transform(lon, lat)
        return ((x - self.west) / self.cell, (self.north - y) / self.cell)

    def corner_lonlat(self) -> dict[str, tuple[float, float]]:
        min_x, min_y, max_x, max_y = self.bounds
        inv = _to_geo(self.crs)
        pts = {"nw": (min_x, max_y), "ne": (max_x, max_y), "sw": (min_x, min_y), "se": (max_x, min_y)}
        return {k: tuple(round(c, 6) for c in inv.transform(x, y)) for k, (x, y) in pts.items()}

    def coarsened(self, factor: float) -> Grid:
        """Misma extensión con celdas `factor` veces más grandes."""
        width = max(1, math.ceil(self.width / factor))
        height = max(1, math.ceil(self.height / factor))
        cell = self.cell * self.width / width
        return replace(self, cell=cell, width=width, height=height)


def _to_proj(crs: str) -> Transformer:
    return Transformer.from_crs("EPSG:4326", crs, always_xy=True)


def _to_geo(crs: str) -> Transformer:
    return Transformer.from_crs(crs, "EPSG:4326", always_xy=True)


def make_grid(bbox: BBox, crs: str, max_size: int) -> Grid:
    """Envolvente proyectada del bbox WGS84 con celdas cuadradas; el lado mayor tiene `max_size` celdas."""
    min_lon, min_lat, max_lon, max_lat = bbox
    fwd = _to_proj(crs)
    xs, ys = fwd.transform(
        [min_lon, max_lon, min_lon, max_lon], [min_lat, min_lat, max_lat, max_lat]
    )
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    extent = max(max_x - min_x, max_y - min_y)
    cell = extent / max_size
    width = max(1, round((max_x - min_x) / cell))
    height = max(1, round((max_y - min_y) / cell))
    return Grid(crs=crs, west=min_x, north=max_y, cell=cell, width=width, height=height)
