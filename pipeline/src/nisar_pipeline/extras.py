"""Capas auxiliares de impacto: pendiente, laderas activas, uso de suelo, población e infraestructura."""

from __future__ import annotations

import json
import logging
import math
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from rasterio.errors import RasterioIOError
from rasterio.warp import Resampling, reproject
from shapely.geometry import LineString

from . import manifest as mf
from . import surface as S
from .config import PipelineConfig, RegionConfig
from .grid import Grid

log = logging.getLogger(__name__)

SLOPE_ACTIVE_DEG = 15.0
MOTION_ACTIVE_CM_YR = 1.0

WORLDCOVER_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
    "ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
)
WORLDPOP_URL = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/"
    "{iso3}/{iso}_ppp_2020_1km_Aggregated.tif"
)
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

WORLDCOVER_CREDIT = mf.Credit(
    name="ESA WorldCover 2021",
    attribution="© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data "
    "(2021) processed by ESA WorldCover consortium (CC BY 4.0)",
    url="https://esa-worldcover.org/",
)
WORLDPOP_CREDIT = mf.Credit(
    name="WorldPop 2020",
    attribution="WorldPop (www.worldpop.org), University of Southampton, 2020 (CC BY 4.0)",
    url="https://www.worldpop.org/",
)
OSM_CREDIT = mf.Credit(
    name="OpenStreetMap",
    attribution="© OpenStreetMap contributors (ODbL)",
    url="https://www.openstreetmap.org/copyright",
)

# valor ESA -> (clase, nombre, color); 0 = sin dato y 1 = sin pintar, por convención del manifiesto
LANDCOVER = {
    10: (2, "Árboles", "#2e7d32"),
    20: (3, "Matorral", "#a1887f"),
    30: (4, "Pastizal", "#cddc39"),
    40: (5, "Cultivos", "#f2c14e"),
    50: (6, "Zona urbana", "#d32f2f"),
    60: (7, "Suelo desnudo", "#d7ccc8"),
    80: (8, "Agua", "#1976d2"),
    90: (9, "Humedal", "#26a69a"),
}


@dataclass
class ExtraLayer:
    layer: mf.Layer
    data: np.ndarray


def slope_degrees(dem: np.ndarray, cell_m: float) -> np.ndarray:
    gy, gx = np.gradient(dem.astype(np.float32), cell_m)
    return np.degrees(np.arctan(np.hypot(gx, gy))).astype(np.float32)


def active_slopes(slope: np.ndarray, velocity: np.ndarray) -> np.ndarray:
    """Clase 2 = ladera activa, 1 = resto, 0 = sin dato de movimiento."""
    out = np.ones(slope.shape, dtype=np.uint8)
    out[~np.isfinite(velocity)] = 0
    with np.errstate(invalid="ignore"):
        out[(slope > SLOPE_ACTIVE_DEG) & (np.abs(velocity) > MOTION_ACTIVE_CM_YR)] = 2
    return out


def remap_landcover(raw: np.ndarray) -> np.ndarray:
    out = np.zeros(raw.shape, dtype=np.uint8)
    for esa, (value, _, _) in LANDCOVER.items():
        out[raw == esa] = value
    return out


def worldcover_tiles(grid: Grid) -> list[str]:
    corners = grid.corner_lonlat().values()
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    tiles = []
    for lat in range(math.floor(min(lats) / 3) * 3, math.ceil(max(lats) / 3) * 3, 3):
        for lon in range(math.floor(min(lons) / 3) * 3, math.ceil(max(lons) / 3) * 3, 3):
            ns = "N" if lat >= 0 else "S"
            ew = "E" if lon >= 0 else "W"
            tiles.append(f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}")
    return tiles


def _warp_into(url: str, grid: Grid, dtype, resampling) -> np.ndarray | None:
    out = np.zeros((grid.height, grid.width), dtype=dtype)
    try:
        with rasterio.open(url) as src:
            reproject(
                source=rasterio.band(src, 1),
                destination=out,
                dst_transform=grid.transform,
                dst_crs=grid.crs,
                dst_nodata=0,
                resampling=resampling,
            )
    except RasterioIOError:
        log.warning("No disponible: %s", url)
        return None
    return out


def load_landcover(grid: Grid) -> np.ndarray:
    raw = np.zeros((grid.height, grid.width), dtype=np.uint8)
    for tile in worldcover_tiles(grid):
        part = _warp_into("/vsicurl/" + WORLDCOVER_URL.format(tile=tile), grid, np.uint8, Resampling.mode)
        if part is not None:
            raw = np.where(part > 0, part, raw)
    return remap_landcover(raw)


def _cached_download(url: str, path: Path) -> Path:
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        log.info("Descargando %s", url)
        urllib.request.urlretrieve(url, tmp)  # noqa: S310 - URL constante
        tmp.replace(path)
    return path


def load_population(grid: Grid, cache_dir: Path) -> np.ndarray:
    """Personas por celda (WorldPop 1 km, México + EE. UU.), conservando el total al remuestrear."""
    total = np.zeros((grid.height, grid.width), dtype=np.float32)
    for iso3 in ("MEX", "USA"):
        url = WORLDPOP_URL.format(iso3=iso3, iso=iso3.lower())
        path = _cached_download(url, cache_dir / "worldpop" / f"{iso3}.tif")
        part = _warp_into(str(path), grid, np.float32, Resampling.sum)
        if part is not None:
            total += np.where(part > 0, part, 0)
    return total


def overpass_query(bbox) -> str:
    w, s, e, n = bbox
    box_ = f"({s},{w},{n},{e})"
    return (
        "[out:json][timeout:120];("
        f'way["highway"~"^(motorway|trunk|primary|secondary)$"]{box_};'
        f'way["waterway"="canal"]{box_};'
        ");out geom tags;"
    )


def fetch_osm(region: RegionConfig, cache_dir: Path) -> dict:
    path = cache_dir / region.id / "osm.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    body = urllib.parse.urlencode({"data": overpass_query(region.bbox)}).encode()
    req = urllib.request.Request(  # noqa: S310 - URL constante
        OVERPASS_URL, data=body, headers={"User-Agent": "nisar-explorer/0.1"}
    )
    with urllib.request.urlopen(req, timeout=180) as res:  # noqa: S310
        data = json.load(res)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")
    return data


def osm_to_grid(data: dict, grid: Grid, tolerance: float = 0.4) -> dict[str, list[dict]]:
    """Vías en coordenadas de grilla, simplificadas y recortadas a la grilla, por tipo."""
    out: dict[str, list[dict]] = {"road": [], "canal": []}
    for el in data.get("elements", []):
        geom = el.get("geometry")
        tags = el.get("tags", {})
        if not geom or len(geom) < 2:
            continue
        kind = "canal" if tags.get("waterway") == "canal" else "road"
        pts = [grid.lonlat_to_colrow(p["lon"], p["lat"]) for p in geom]
        pts = [(c, r) for c, r in pts if 0 <= c <= grid.width and 0 <= r <= grid.height]
        if len(pts) < 2:
            continue
        line = LineString(pts).simplify(tolerance)
        out[kind].append({
            "name": tags.get("name") or tags.get("ref") or "",
            "class": tags.get("highway") or "canal",
            "points": [[round(c, 2), round(r, 2)] for c, r in line.coords],
        })
    return out


def _continuous(
    region_id: str, layer_id: str, name: str, description: str, theme: str, units: str,
    cube: np.ndarray, scale: float, palette: str, dates: list[str], products: list[str],
) -> ExtraLayer:
    valid = cube[np.isfinite(cube)]
    lo, hi = (np.percentile(valid, [2, 98]) if valid.size else (0.0, 1.0))
    encoded = np.clip(np.rint(np.nan_to_num(cube / scale, nan=0.0)), -32767, 32767).astype("<i2")
    encoded[~np.isfinite(cube)] = -32768
    return ExtraLayer(mf.Layer(
        id=layer_id, type="raster", theme=theme, name=name, description=description, units=units,
        path=f"{region_id}/{layer_id}/cube.bin", scale=scale, dates=dates,
        valueRange=(round(float(lo), 3), round(float(hi), 3)), paint="sequential", palette=palette,
        source="nisar", products=products, credits=[mf.NISAR_CREDIT],
    ), encoded)


def _classes(
    region_id: str, layer_id: str, name: str, description: str, theme: str,
    cube: np.ndarray, classes: list[tuple[int, str, str]], dates: list[str], products: list[str],
) -> ExtraLayer:
    return ExtraLayer(mf.Layer(
        id=layer_id, type="raster", theme=theme, name=name, description=description, units="clase",
        path=f"{region_id}/{layer_id}/cube.bin", encoding="uint8", scale=1.0, nodata=0, dates=dates,
        valueRange=(1.0, float(max(c[0] for c in classes))), paint="categorical",
        classes=[mf.LayerClass(value=v, name=n, color=c) for v, n, c in classes],
        source="nisar", products=products, credits=[mf.NISAR_CREDIT],
    ), cube.astype(np.uint8))


def decomposition_layers(
    cfg: PipelineConfig, region: RegionConfig, grid: Grid, velocity: np.ndarray, products: list[str],
) -> list[ExtraLayer]:
    from .nisar import decomposition  # nisar importa build, que importa este módulo

    layer = next(lyr for lyr in region.layers if lyr.secondary_stack)
    up, east, ids = decomposition(cfg, region, layer, grid, velocity, products)
    out = []
    for lid, name, text, field in (
        ("vertical", "Movimiento vertical",
         "Cuánto sube o baja el suelo por año, combinando dos órbitas. Negativo = baja.", up),
        ("east-west", "Movimiento este-oeste",
         "Movimiento horizontal por año; positivo = hacia el este. Las flechas muestran su "
         "dirección. El norte-sur no se mide bien con esta geometría.", east),
    ):
        extra = _continuous(region.id, lid, name, text, "movement", "cm/año", field[None], 0.01,
                            "vik", [], ids)
        lim = max(abs(extra.layer.valueRange[0]), abs(extra.layer.valueRange[1]))
        extra.layer.paint = "diverging"
        extra.layer.valueRange = (-lim, lim)
        extra.layer.referenceDate = "2026-10-01"
        out.append(extra)
    return out


def surface_layers(
    cfg: PipelineConfig, region: RegionConfig, grid: Grid, slope: np.ndarray,
    land: np.ndarray,
) -> list[ExtraLayer]:
    """HH, HV, cambios y agua desde GCOV mensual."""
    scenes = S.monthly_scenes(region, "GCOV", region.surface_stack)
    if len(scenes) < 2:
        raise RuntimeError(f"{region.id}: solo {len(scenes)} escenas GCOV en el stack")
    subs = S.fetch_scenes(scenes, grid, cfg.cache_dir / region.id / "gcov", "GCOV")
    hh = np.stack([S.to_db(S.to_grid(s, "hh", grid)) for s in subs])
    hv = np.stack([S.to_db(S.to_grid(s, "hv", grid)) for s in subs])
    dates = [s.date for s in scenes]
    ids = [s.id for s in scenes]
    rid = region.id
    return [
        _continuous(rid, "hh", "Construcciones y suelo",
                    "Radar HH: las construcciones y superficies duras devuelven más señal.",
                    "surface", "dB", hh, 0.01, "gray", dates, ids),
        _continuous(rid, "hv", "Vegetación",
                    "Radar HV: la vegetación devuelve más señal; sigue los ciclos de cultivo.",
                    "surface", "dB", hv, 0.01, "greens", dates, ids),
        _classes(rid, "change", "Cambios en la superficie",
                 f"Dónde la señal HH cambió más de {S.CHANGE_DB:.0f} dB desde la primera fecha. "
                 "Indica que algo es distinto, no su causa.",
                 "surface", S.change_classes(hh),
                 [(2, "Señal más fuerte", "#e53935"), (3, "Señal más débil", "#43a047")], dates, ids),
        _classes(rid, "water", "Agua en superficie",
                 "Agua permanente según el mapa de cobertura. Agua nueva = la señal del radar cae "
                 "con fuerza respecto a lo normal de ese punto, sin contar laderas en sombra.",
                 "water", S.water_classes(hh, slope, land == LANDCOVER[80][0]),
                 [(2, "Agua permanente", "#1565c0"), (3, "Agua nueva", "#00e5ff")], dates, ids),
    ]


def moisture_layer(cfg: PipelineConfig, region: RegionConfig, grid: Grid) -> ExtraLayer:
    scenes = S.monthly_scenes(region, "SME2", region.surface_stack)
    subs = S.fetch_scenes(scenes, grid, cfg.cache_dir / region.id / "sme2", "SME2")
    cube = np.stack([S.to_grid(s, "sm", grid) for s in subs])
    return _continuous(
        region.id, "moisture", "Humedad del suelo",
        "Agua en los primeros centímetros del suelo, de seco a húmedo. Resolución de ~200 m.",
        "water", "m³/m³", cube, 0.001, "blues", [s.date for s in scenes], [s.id for s in scenes],
    )


def build_extras(
    cfg: PipelineConfig,
    region: RegionConfig,
    grid: Grid,
    dem: np.ndarray,
    velocity: np.ndarray | None,
    out_dir: Path,
    aux: dict | None = None,
    fetch: Callable[[RegionConfig, Path], dict] = fetch_osm,
    landcover: Callable[[Grid], np.ndarray] = load_landcover,
    population: Callable[[Grid, Path], np.ndarray] = load_population,
) -> tuple[list[ExtraLayer], list[mf.Overlay]]:
    layers: list[ExtraLayer] = []
    overlays: list[mf.Overlay] = []
    wanted = set(region.extras)
    slope = slope_degrees(dem, grid.cell)

    def path(layer_id: str) -> str:
        return f"{region.id}/{layer_id}/cube.bin"

    if "slope" in wanted:
        layers.append(ExtraLayer(mf.Layer(
            id="slope", type="raster", theme="impact", name="Pendiente",
            description="Inclinación del terreno, calculada del relieve.",
            units="°", path=path("slope"), scale=0.1, dates=[], referenceDate="2014-01-01",
            valueRange=(0.0, round(float(np.percentile(slope, 99.5)), 1)),
            paint="sequential", palette="heat", source="derived", products=[],
            credits=[mf.COPERNICUS_CREDIT],
        ), np.rint(slope * 10)[None].astype("<i2")))

    if "active-slopes" in wanted and velocity is not None:
        layers.append(ExtraLayer(mf.Layer(
            id="active-slopes", type="raster", theme="impact", name="Laderas activas",
            description=f"Terreno de más de {SLOPE_ACTIVE_DEG:.0f}° donde además el radar detecta "
            f"más de {MOTION_ACTIVE_CM_YR:.0f} cm/año de movimiento. Señala dónde mirar; "
            "no confirma un deslizamiento.",
            units="clase", path=path("active-slopes"), encoding="uint8", scale=1.0, nodata=0,
            dates=[], referenceDate="2026-10-01", valueRange=(1.0, 2.0), paint="categorical",
            classes=[mf.LayerClass(value=2, name="Ladera activa", color="#e53935")],
            source="derived", products=[], credits=[mf.COPERNICUS_CREDIT, mf.NISAR_CREDIT],
        ), active_slopes(slope, velocity)[None]))

    land = landcover(grid) if {"landcover", "surface"} & wanted else None
    if "landcover" in wanted:
        layers.append(ExtraLayer(mf.Layer(
            id="landcover", type="raster", theme="impact", name="Uso de suelo",
            description="Cobertura del terreno en 2021. No viene de NISAR.",
            units="clase", path=path("landcover"), encoding="uint8", scale=1.0, nodata=0,
            dates=[], referenceDate="2021-01-01", valueRange=(2.0, 9.0), paint="categorical",
            classes=[mf.LayerClass(value=v, name=n, color=c) for v, n, c in LANDCOVER.values()],
            source="esa-worldcover", products=[], credits=[WORLDCOVER_CREDIT],
        ), land[None]))

    if "population" in wanted:
        pop = population(grid, cfg.cache_dir)
        layers.append(ExtraLayer(mf.Layer(
            id="population", type="raster", theme="impact", name="Población",
            description="Personas estimadas por celda en 2020. Es un modelo a 1 km, no un censo.",
            units="personas", path=path("population"), scale=1.0, dates=[],
            referenceDate="2020-01-01",
            valueRange=(0.0, round(float(np.percentile(pop[pop > 0], 99)), 0) if (pop > 0).any() else 1.0),
            paint="sequential", palette="heat", source="worldpop", products=[],
            credits=[WORLDPOP_CREDIT],
        ), np.clip(np.rint(pop), 0, 32767)[None].astype("<i2")))

    if "disturbance" in wanted and aux and "coherence" in aux:
        layers.append(_classes(
            region.id, "disturbance", "Disturbios",
            "Dónde el radar perdió coherencia respecto a lo normal en ese punto: algo cambió entre "
            "dos pasadas, como obras, cosecha o inundación.",
            "movement", S.disturbance_classes(aux["coherence"]),
            [(2, "Disturbio", "#ff6f00")], aux["pair_dates"], aux["products"],
        ))

    jobs: dict[str, Callable[[], list[ExtraLayer]]] = {}
    if velocity is not None and aux:
        jobs["decomposition"] = lambda: decomposition_layers(
            cfg, region, grid, velocity, aux.get("products", [])
        )
    if region.surface_stack:
        jobs["surface"] = lambda: surface_layers(cfg, region, grid, slope, land)
        jobs["moisture"] = lambda: [moisture_layer(cfg, region, grid)]
    if jobs:
        for key, job in jobs.items():
            if key not in wanted:
                continue
            try:
                layers.extend(job())
            except Exception as exc:  # noqa: BLE001 - una capa no debe tumbar a las demás
                log.error("%s/%s: no se generó: %s", region.id, key, exc)

    if "infrastructure" in wanted:
        features = osm_to_grid(fetch(region, cfg.cache_dir), grid)
        for kind, oid, name in (("road", "roads", "Caminos"), ("canal", "canals", "Canales")):
            rel = f"{region.id}/{oid}.json"
            target = out_dir / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(features[kind], ensure_ascii=False), encoding="utf-8")
            overlays.append(mf.Overlay(id=oid, name=name, kind=kind, path=rel, credits=[OSM_CREDIT]))
    return layers, overlays
