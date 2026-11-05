"""Contrato del manifiesto que consume la app web (espejado en src/features/explorer/manifest.ts)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_VERSION = 2

LonLat = tuple[float, float]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credit(_Model):
    name: str
    attribution: str
    url: str


class Corners(_Model):
    nw: LonLat
    ne: LonLat
    sw: LonLat
    se: LonLat


class PoiOut(_Model):
    id: str
    name: str
    description: str
    lon: float
    lat: float
    col: float = Field(description="Columna fraccionaria en la grilla de la región")
    row: float = Field(description="Fila fraccionaria en la grilla de la región (0 = norte)")


class Terrain(_Model):
    path: str
    encoding: Literal["int16-le"] = "int16-le"
    units: Literal["m"] = "m"
    heightRange: tuple[float, float]
    credits: list[Credit]


class LayerClass(_Model):
    value: int
    name: str
    color: str


class Layer(_Model):
    id: str
    type: str  # "los-displacement" o "raster"; la web ignora tipos desconocidos
    theme: Literal["movement", "surface", "water", "impact"]
    name: str
    description: str
    units: str
    path: str
    encoding: Literal["int16-le", "uint8"] = "int16-le"
    scale: float = Field(description="Multiplicador entero -> unidades (mm -> cm = 0.1)")
    nodata: int = -32768
    dates: list[str] = Field(description="Vacío = capa estática de una sola banda")
    referenceDate: str | None = Field(default=None, description="Fecha de una capa estática")
    valueRange: tuple[float, float]
    paint: Literal["diverging", "sequential", "categorical"] = "diverging"
    palette: Literal["vik", "heat", "gray", "greens", "blues"] = "vik"
    classes: list[LayerClass] = []
    source: Literal["nisar", "sentinel-1", "synthetic", "derived", "esa-worldcover", "worldpop"]
    products: list[str]
    credits: list[Credit]


class Overlay(_Model):
    id: str
    name: str
    kind: Literal["road", "canal"]
    path: str
    credits: list[Credit]


class Region(_Model):
    id: str
    name: str
    bbox: tuple[float, float, float, float]
    bboxProjected: tuple[float, float, float, float]
    corners: Corners
    width: int
    height: int
    cellSizeM: float
    terrain: Terrain
    pois: list[PoiOut]
    layers: list[Layer]
    overlays: list[Overlay] = []


class Manifest(_Model):
    schemaVersion: Literal[2] = SCHEMA_VERSION
    generatedAt: str
    projection: str
    regions: list[Region]


COPERNICUS_CREDIT = Credit(
    name="Copernicus DEM GLO-30",
    attribution=(
        "Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and "
        "Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; "
        "all rights reserved"
    ),
    url="https://registry.opendata.aws/copernicus-dem/",
)

NISAR_CREDIT = Credit(
    name="NASA-ISRO SAR (NISAR) L2 GUNW",
    attribution="NISAR data courtesy of NASA/JPL-Caltech and ISRO, distributed by the ASF DAAC",
    url="https://search.asf.alaska.edu/",
)

SYNTHETIC_CREDIT = Credit(
    name="Datos sintéticos de desarrollo",
    attribution="Generados por nisar-pipeline --synthetic. No son mediciones NISAR.",
    url="pipeline/README.md#modo-sintético",
)
