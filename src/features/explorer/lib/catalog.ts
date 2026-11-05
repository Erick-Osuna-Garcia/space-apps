/** Catálogo de capas por temas y lecturas del inspector. Lógica pura. */
import type { Layer, Region } from "../manifest";
import type { MapView } from "../store";
import { cellIndex } from "./grid";

export type Theme = Layer["theme"];

export const THEMES: Array<{ id: Theme; label: string }> = [
	{ id: "movement", label: "Movimiento" },
	{ id: "surface", label: "Superficie" },
	{ id: "water", label: "Agua" },
	{ id: "impact", label: "Impacto" },
];

export interface CatalogItem {
	view: MapView;
	theme: Theme;
	name: string;
	disabled?: boolean;
	layer?: Layer;
}

const MOVEMENT_VIEWS: Array<{ view: MapView; name: string }> = [
	{ view: "cumulative", name: "Acumulado" },
	{ view: "velocity", name: "Velocidad" },
	{ view: "zones", name: "Zonas" },
	{ view: "differential", name: "Diferencial" },
	{ view: "acceleration", name: "Aceleración" },
];

export const displacementLayer = (region: Region | null) =>
	region?.layers.find((l) => l.type === "los-displacement") ?? null;

export const rasterView = (layerId: string): MapView => `layer:${layerId}`;

/** Capas disponibles en la región, por tema; lo que no existe no aparece. */
export function buildCatalog(
	region: Region,
	minDatesAcceleration: number,
): CatalogItem[] {
	const items: CatalogItem[] = [];
	const disp = displacementLayer(region);
	if (disp) {
		for (const v of MOVEMENT_VIEWS) {
			items.push({
				...v,
				theme: "movement",
				disabled:
					v.view === "acceleration" && disp.dates.length < minDatesAcceleration,
			});
		}
	}
	for (const layer of region.layers) {
		if (layer.type !== "raster") continue;
		items.push({
			view: rasterView(layer.id),
			theme: layer.theme,
			name: layer.name,
			layer,
		});
	}
	return items;
}

/** Vista válida para la región: la pedida si existe, si no la primera disponible. */
export function resolveView(
	catalog: CatalogItem[],
	view: MapView,
): CatalogItem | null {
	return (
		catalog.find((i) => i.view === view && !i.disabled) ??
		catalog.find((i) => !i.disabled) ??
		null
	);
}

/** Índice de la fecha más cercana; -1 si no hay fechas. */
export function nearestDateIndex(dates: string[], date: string | null): number {
	if (dates.length === 0) return -1;
	if (!date) return dates.length - 1;
	const t = Date.parse(date);
	let best = 0;
	let bestDist = Number.POSITIVE_INFINITY;
	dates.forEach((d, i) => {
		const dist = Math.abs(Date.parse(d) - t);
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	});
	return best;
}

export type RasterData = Int16Array | Uint8Array;

/** Plano de una capa continua en sus unidades (NaN = sin dato). */
export function continuousPlane(
	data: RasterData,
	layer: Pick<Layer, "scale" | "nodata">,
	plane: number,
	index: number,
): Float32Array {
	const out = new Float32Array(plane);
	const base = Math.max(index, 0) * plane;
	for (let p = 0; p < plane; p++) {
		const raw = data[base + p];
		out[p] = raw === layer.nodata ? Number.NaN : raw * layer.scale;
	}
	return out;
}

/** Plano de una capa categórica. */
export function categoricalPlane(
	data: RasterData,
	plane: number,
	index: number,
): Uint8Array {
	const base = Math.max(index, 0) * plane;
	return Uint8Array.from(data.subarray(base, base + plane));
}

/** Colores por valor de clase: 0 = sin dato y 1 = sin pintar, por convención. */
export function classColors(
	layer: Pick<Layer, "classes">,
	fallback: string,
): string[] {
	const colors = Array.from({ length: 16 }, () => fallback);
	for (const c of layer.classes) if (c.value < 16) colors[c.value] = c.color;
	return colors;
}

export const NO_READING = "Sin dato";

/** Lo que dice una capa de una celda, en texto. */
export function readLayer(
	layer: Layer,
	data: RasterData,
	region: Pick<Region, "width" | "height">,
	col: number,
	row: number,
	date: string | null,
): string {
	const plane = region.width * region.height;
	const index = Math.max(nearestDateIndex(layer.dates, date), 0);
	const raw =
		data[index * plane + cellIndex(region.width, region.height, col, row)];
	if (raw === undefined || raw === layer.nodata) return NO_READING;
	if (layer.paint === "categorical") {
		return layer.classes.find((c) => c.value === raw)?.name ?? NO_READING;
	}
	return `${(raw * layer.scale).toFixed(1)} ${layer.units}`;
}

/** Fuente de una capa en una fecha, para capas que combinan satélites. */
export function sourceAt(
	layer: Pick<Layer, "source" | "segments">,
	date: string | null,
): Layer["source"] {
	if (!date) return layer.source;
	return layer.segments.find((s) => date <= s.until)?.source ?? layer.source;
}

export const SOURCE_NAMES: Partial<Record<Layer["source"], string>> = {
	nisar: "NISAR",
	"sentinel-1": "Sentinel-1",
};

/** Capa que mejor muestra un tipo de evento. */
export function eventView(type: string): MapView {
	if (type === "water" || type === "disturbance" || type === "change") {
		return rasterView(type);
	}
	return "zones";
}
