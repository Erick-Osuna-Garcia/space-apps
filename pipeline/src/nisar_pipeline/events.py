"""Eventos de impacto detectados en las capas, ubicados por zonas.

Un evento es un cambio medido, con fecha y lugar. No se afirma su causa.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from datetime import date

import numpy as np

from .config import RegionConfig
from .grid import Grid
from .surface import box_blur
from .timeseries import velocity_from_cube

MIN_ZONE_KM2 = 2.0
SUBSIDENCE_CM = 3.0
SMOOTH_RADIUS = 4  # celdas: quita el moteado de parcelas sueltas antes de agrupar
RATE_CHANGE_CM_YR = 1.5
MIN_SEGMENT_DAYS = 365
MIN_WATER_KM2 = 1.0
MIN_DISTURBANCE_KM2 = 3.0
MIN_CHANGE_KM2 = 1.0
MAX_PER_TYPE = 8

_COMPASS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]


@dataclass
class Event:
    id: str
    type: str
    date: str
    dateEnd: str | None
    place: str
    col: float
    row: float
    areaKm2: float
    title: str
    detail: str
    source: str


def components(mask: np.ndarray) -> list[np.ndarray]:
    """Grupos conexos (8 vecinos) de un raster booleano, como índices planos."""
    h, w = mask.shape
    flat = mask.ravel()
    seen = np.zeros(flat.size, dtype=bool)
    out = []
    for start in np.flatnonzero(flat):
        if seen[start]:
            continue
        seen[start] = True
        stack = [int(start)]
        members = []
        while stack:
            p = stack.pop()
            members.append(p)
            j, i = divmod(p, w)
            for y in (j - 1, j, j + 1):
                if not 0 <= y < h:
                    continue
                for x in (i - 1, i, i + 1):
                    if 0 <= x < w:
                        q = y * w + x
                        if flat[q] and not seen[q]:
                            seen[q] = True
                            stack.append(q)
        out.append(np.array(members))
    return out


def describe_place(region: RegionConfig, grid: Grid, col: float, row: float) -> str:
    """Ubicación relativa al punto de interés más cercano."""
    best, best_d = None, math.inf
    for poi in region.pois:
        c, r = grid.lonlat_to_colrow(poi.lon, poi.lat)
        d = math.hypot(c - col, r - row)
        if d < best_d:
            best, best_d, dc, dr = poi, d, col - c, row - r
    if best is None:
        return "Sin referencia"
    km = best_d * grid.cell / 1000
    if km < 1:
        return best.name
    angle = math.degrees(math.atan2(dc, -dr)) % 360
    return f"A {km:.0f} km al {_COMPASS[round(angle / 45) % 8]} de {best.name}"


def _centroid(cells: np.ndarray, width: int) -> tuple[float, float]:
    rows, cols = np.divmod(cells, width)
    return float(cols.mean()) + 0.5, float(rows.mean()) + 0.5


def _year(d: date) -> float:
    return d.year + (d.timetuple().tm_yday - 1) / 365.25


def rate_change(series: np.ndarray, dates: list[date]) -> tuple[int, float, float] | None:
    """Mejor punto de quiebre de una serie: (índice, velocidad antes, velocidad después)."""
    t = np.array([_year(d) for d in dates])
    ok = np.isfinite(series)
    best = None
    for k in range(1, len(dates) - 1):
        a, b = ok & (np.arange(len(t)) <= k), ok & (np.arange(len(t)) >= k)
        if a.sum() < 4 or b.sum() < 4:
            continue
        if (dates[k] - dates[0]).days < MIN_SEGMENT_DAYS:
            continue
        if (dates[-1] - dates[k]).days < MIN_SEGMENT_DAYS:
            continue
        pa = np.polyfit(t[a], series[a], 1)
        pb = np.polyfit(t[b], series[b], 1)
        err = ((np.polyval(pa, t[a]) - series[a]) ** 2).sum() + (
            (np.polyval(pb, t[b]) - series[b]) ** 2
        ).sum()
        if best is None or err < best[0]:
            best = (err, k, float(pa[0]), float(pb[0]))
    return None if best is None else best[1:]


def subsidence_events(
    cube: np.ndarray, dates: list[date], region: RegionConfig, grid: Grid, source: str,
) -> list[Event]:
    cell_km2 = (grid.cell / 1000) ** 2
    velocity = velocity_from_cube(cube, dates)
    smooth = box_blur(cube[-1], SMOOTH_RADIUS)
    with np.errstate(invalid="ignore"):
        mask = smooth <= -SUBSIDENCE_CM
    zones = [c for c in components(mask) if c.size * cell_km2 >= MIN_ZONE_KM2]
    zones.sort(key=lambda c: -c.size)
    out: list[Event] = []
    flat = cube.reshape(cube.shape[0], -1)
    for n, cells in enumerate(zones[:MAX_PER_TYPE], 1):
        col, row = _centroid(cells, grid.width)
        place = describe_place(region, grid, col, row)
        last = smooth.ravel()[cells]
        deepest = int(cells[np.nanargmin(last)])
        worst = float(np.nanmin(last))
        # el suavizado agrega un halo casi inmóvil: las medianas van solo sobre lo que bajó
        with np.errstate(invalid="ignore"):
            core = cells[flat[-1, cells] <= -SUBSIDENCE_CM]
        core = core if core.size else cells
        rate = float(np.nanmedian(velocity.ravel()[core]))
        area = cells.size * cell_km2
        out.append(Event(
            id=f"hundimiento-{n}", type="subsidence", date=dates[0].isoformat(),
            dateEnd=dates[-1].isoformat(), place=place,
            col=deepest % grid.width + 0.5, row=deepest // grid.width + 0.5,
            areaKm2=round(area, 1),
            title=f"Zona {n}: hundimiento de hasta {abs(worst):.0f} cm",
            detail=f"{area:.0f} km² bajaron más de {SUBSIDENCE_CM:.0f} cm, a {rate:.1f} cm/año "
            "de mediana, en línea de vista.",
            source=source,
        ))
        series = np.nanmedian(flat[:, core], axis=1)
        change = rate_change(series, dates)
        if change and abs(change[2] - change[1]) >= RATE_CHANGE_CM_YR:
            k, before, after = change
            faster = after < before
            out.append(Event(
                id=f"ritmo-{n}", type="rate-change", date=dates[k].isoformat(), dateEnd=None,
                place=place, col=col, row=row, areaKm2=round(area, 1),
                title=f"Zona {n}: el hundimiento se {'aceleró' if faster else 'frenó'}",
                detail=f"Pasó de {before:.1f} a {after:.1f} cm/año alrededor de esta fecha.",
                source=source,
            ))
    return out


def class_events(
    cube: np.ndarray, value: int, dates: list[str], region: RegionConfig, grid: Grid,
    *, kind: str, min_km2: float, title: str, detail: str, source: str = "nisar",
) -> list[Event]:
    """Las áreas más grandes de una clase en cualquier fecha; la misma zona cuenta una vez."""
    cell_km2 = (grid.cell / 1000) ** 2
    found: list[tuple[float, int, np.ndarray]] = []
    for t in range(cube.shape[0]):
        for cells in components(cube[t] == value):
            area = cells.size * cell_km2
            if area >= min_km2:
                found.append((area, t, cells))
    found.sort(key=lambda f: -f[0])
    out: list[Event] = []
    taken = np.zeros(cube.shape[1] * cube.shape[2], dtype=bool)
    for area, t, cells in found:
        if taken[cells].mean() > 0.3:
            continue
        taken[cells] = True
        col, row = _centroid(cells, grid.width)
        out.append(Event(
            id=f"{kind}-{len(out) + 1}", type=kind, date=dates[t], dateEnd=None,
            place=describe_place(region, grid, col, row), col=col, row=row,
            areaKm2=round(area, 1), title=title.format(area=area),
            detail=detail, source=source,
        ))
        if len(out) >= MAX_PER_TYPE:
            break
    return out


def to_json(events: list[Event]) -> list[dict]:
    return [asdict(e) for e in sorted(events, key=lambda e: e.dateEnd or e.date, reverse=True)]
