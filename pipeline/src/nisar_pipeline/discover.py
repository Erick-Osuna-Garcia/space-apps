"""Descubrimiento de productos NISAR GUNW en ASF DAAC (no requiere credenciales)."""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path

from shapely.geometry import Point, box, shape

from .config import LayerConfig, RegionConfig

log = logging.getLogger(__name__)

_TIMES = re.compile(r"_(\d{8})T\d{6}")


class DiscoveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class Product:
    id: str
    url: str
    ref_date: str
    sec_date: str
    relative_orbit: int
    frame: int
    direction: str
    processing_date: str
    bytes: int
    covers_center: bool


@dataclass
class Discovery:
    region: str
    layer: str
    criteria: dict
    stacks: list[dict]
    chosen: dict | None
    products: list[Product]  # del stack elegido, un producto por par (más reciente)

    @property
    def dates(self) -> list[date]:
        ds = {p.ref_date for p in self.products} | {p.sec_date for p in self.products}
        return sorted(date.fromisoformat(d) for d in ds)

    def to_json(self) -> dict:
        d = asdict(self)
        d["dates"] = [x.isoformat() for x in self.dates]
        return d


SearchFn = Callable[..., list]


def _asf_search(**kwargs) -> list:
    import asf_search as asf

    return list(asf.search(dataset=asf.DATASET.NISAR, maxResults=5000, **kwargs))


def _wkt(bbox) -> str:
    return box(*bbox).wkt


def _to_product(result, center: Point) -> Product | None:
    pr = result.properties
    name = pr["sceneName"]
    times = _TIMES.findall(name)
    if len(times) < 4:
        log.warning("Nombre de producto inesperado, se omite: %s", name)
        return None
    ref, sec = times[0], times[2]
    size = pr.get("bytes", 0)
    if isinstance(size, dict):
        size = sum(v.get("bytes", 0) for k, v in size.items() if k.endswith(".h5"))
    return Product(
        id=name,
        url=pr["url"],
        ref_date=f"{ref[:4]}-{ref[4:6]}-{ref[6:]}",
        sec_date=f"{sec[:4]}-{sec[4:6]}-{sec[6:]}",
        relative_orbit=int(pr["pathNumber"]),
        frame=int(pr["frameNumber"]),
        direction=str(pr.get("flightDirection", "")),
        processing_date=str(pr.get("processingDate", "")),
        bytes=int(size or 0),
        covers_center=shape(result.geometry).contains(center),
    )


def discover(
    region: RegionConfig, layer: LayerConfig, center: tuple[float, float],
    search_fn: SearchFn = _asf_search,
) -> Discovery:
    start, end = region.date_range
    criteria = {
        "dataset": "NISAR",
        "processingLevel": layer.product,
        "intersectsWith": _wkt(region.bbox),
        "start": datetime.combine(start, datetime.min.time()).isoformat() + "Z",
        "end": datetime.combine(end, datetime.max.time()).isoformat(timespec="seconds") + "Z",
        "polarization": layer.polarization,
    }
    results = search_fn(
        processingLevel=layer.product,
        intersectsWith=criteria["intersectsWith"],
        start=criteria["start"],
        end=criteria["end"],
    )
    pt = Point(*center)
    products = [p for r in results if (p := _to_product(r, pt)) is not None]
    products = [
        p for p in products
        if start.isoformat() <= p.ref_date and p.sec_date <= end.isoformat()
    ]

    by_stack: dict[tuple[int, int], list[Product]] = defaultdict(list)
    for p in products:
        if p.covers_center:
            by_stack[(p.relative_orbit, p.frame)].append(p)

    stacks = []
    for (orbit, frame), ps in sorted(by_stack.items()):
        pairs = {(p.ref_date, p.sec_date) for p in ps}
        stacks.append({
            "relative_orbit": orbit, "frame": frame, "direction": ps[0].direction,
            "products": len(ps), "pairs": len(pairs),
        })

    if layer.stack:
        key = (layer.stack.relative_orbit, layer.stack.frame)
    elif stacks:
        best = max(stacks, key=lambda s: (s["pairs"], -s["relative_orbit"]))
        key = (best["relative_orbit"], best["frame"])
    else:
        key = None

    chosen_products: list[Product] = []
    if key and key in by_stack:
        latest: dict[tuple[str, str], Product] = {}
        for p in sorted(by_stack[key], key=lambda p: p.processing_date):
            latest[(p.ref_date, p.sec_date)] = p
        chosen_products = sorted(latest.values(), key=lambda p: (p.ref_date, p.sec_date))

    disc = Discovery(
        region=region.id,
        layer=layer.id,
        criteria=criteria,
        stacks=stacks,
        chosen=next((s for s in stacks if (s["relative_orbit"], s["frame"]) == key), None),
        products=chosen_products,
    )
    if not chosen_products:
        raise DiscoveryError(
            f"{region.id}/{layer.id}: no hay productos NISAR {layer.product} que cubran el punto "
            f"{center} con los criterios {json.dumps(criteria)}"
            + (f" en el stack fijado {key}" if layer.stack else "")
        )
    return disc


def write_report(disc: Discovery, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(disc.to_json(), indent=2) + "\n", encoding="utf-8")
    return path
