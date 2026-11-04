"""Configuración declarativa de regiones (regions.yaml)."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

BBox = tuple[float, float, float, float]


def _check_bbox(bbox: BBox) -> BBox:
    min_lon, min_lat, max_lon, max_lat = bbox
    if not (-180 <= min_lon < max_lon <= 180):
        raise ValueError(f"bbox longitudes inválidas: {bbox}")
    if not (-90 <= min_lat < max_lat <= 90):
        raise ValueError(f"bbox latitudes inválidas: {bbox}")
    return bbox


class Poi(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    lon: float
    lat: float
    description: str = ""


class StackConfig(BaseModel):
    """Fija el stack (track/frame) a usar; si se omite, se elige el de más pares."""

    relative_orbit: int
    frame: int


class LayerConfig(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    type: Literal["los-displacement"]
    product: Literal["GUNW"]
    polarization: Literal["HH", "VV"] = "HH"
    coherence_threshold: float = Field(default=0.3, ge=0, le=1)
    ionosphere_correction: bool = True
    reference_bbox: BBox
    stack: StackConfig | None = None

    _v_ref = field_validator("reference_bbox")(lambda cls, v: _check_bbox(v))


class RegionConfig(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    bbox: BBox
    date_range: tuple[date, date]
    pois: list[Poi] = []
    layers: list[LayerConfig] = []

    _v_bbox = field_validator("bbox")(lambda cls, v: _check_bbox(v))

    @model_validator(mode="after")
    def _check(self) -> RegionConfig:
        if self.date_range[0] >= self.date_range[1]:
            raise ValueError(f"{self.id}: date_range debe ir de menor a mayor")
        min_lon, min_lat, max_lon, max_lat = self.bbox
        for poi in self.pois:
            if not (min_lon <= poi.lon <= max_lon and min_lat <= poi.lat <= max_lat):
                raise ValueError(f"{self.id}: POI {poi.id} fuera del bbox")
        for layer in self.layers:
            r = layer.reference_bbox
            if not (min_lon <= r[0] and r[2] <= max_lon and min_lat <= r[1] and r[3] <= max_lat):
                raise ValueError(f"{self.id}/{layer.id}: reference_bbox fuera del bbox")
        return self


class PipelineConfig(BaseModel):
    output_dir: Path
    cache_dir: Path
    max_grid_size: int = Field(default=512, ge=16, le=4096)
    size_budget_mb: float = Field(default=15, gt=0)
    projection: str = "EPSG:32611"
    regions: list[RegionConfig]

    @model_validator(mode="after")
    def _unique(self) -> PipelineConfig:
        ids = [r.id for r in self.regions]
        if len(ids) != len(set(ids)):
            raise ValueError("ids de región duplicados")
        return self


def load_config(path: str | Path) -> PipelineConfig:
    path = Path(path)
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    cfg = PipelineConfig.model_validate(raw)
    base = path.resolve().parent
    cfg.output_dir = (base / cfg.output_dir).resolve()
    cfg.cache_dir = (base / cfg.cache_dir).resolve()
    return cfg
