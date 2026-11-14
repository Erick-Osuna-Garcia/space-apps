/**
 * Zonas agrícolas del Valle de Mexicali. Lógica pura sobre la grilla ya cargada.
 * No son las zonas de hundimiento de `impact.ts`.
 */
import type { Feature, Segment } from "./infrastructure";

export const CROP_CLASS = 5;
export const MIN_ZONE_KM2 = 1;
export const SPLIT_KM2 = 25;
export const TILE_CELLS = 16;
export const LIST_CAP = 12;
export const MAX_COMPARE = 3;
export const WATERWAY_MAX_M = 2000;
export const HV_DELTA_DB = 3;
export const SIGNAL_SHARE = 0.1;
export const WATER_RING = 1;

export const AGRI_COPY = {
	coverage:
		"La clase Cultivos es el mapa de cobertura de 2021. No identifica el cultivo de cada fecha NISAR.",
	noAdvice: "Esta vista no estima la cosecha ni aconseja riego.",
	moisture:
		"La humedad describe los primeros centímetros del suelo, a unos 200 m.",
	noCause:
		"Un cambio medido indica que la superficie se ve distinta. No indica su causa.",
	proximity:
		"La cercanía es contexto del territorio: no demuestra riego ni suministro.",
	compareLimit: "La comparación admite hasta 3 zonas.",
	missingCover: "Falta el mapa de cobertura. Sin él no hay zonas agrícolas.",
	noReading: "Sin lectura",
} as const;

export function listHelp(omitted: boolean): string {
	const base = `Se listan hasta ${LIST_CAP} zonas, las de mayor área. Cada una mide al menos ${MIN_ZONE_KM2} km². Un bloque de más de ${SPLIT_KM2} km² se parte en cuadros de ${TILE_CELLS} celdas.`;
	return omitted
		? `${base} Hay más zonas: toca el mapa para elegir una que no está en la lista.`
		: base;
}

export interface AgriZone {
	id: number;
	areaKm2: number;
	cells: number[];
	minCell: number;
	/** Centroide, en coordenadas de grilla. */
	col: number;
	row: number;
}

export interface AgriMap {
	zones: AgriZone[];
	/** Id de zona por celda, o -1. */
	owner: Int32Array;
}

interface Piece {
	cells: number[];
	minCell: number;
	areaKm2: number;
}

/** Celdas que cruza una vía: separan bloques y no se borran del mapa de cobertura. */
export function barrierMask(
	width: number,
	height: number,
	features: Feature[],
): Uint8Array {
	const mask = new Uint8Array(width * height);
	for (const feature of features) {
		for (let k = 1; k < feature.points.length; k++) {
			const [ax, ay] = feature.points[k - 1];
			const [bx, by] = feature.points[k];
			const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
			for (let s = 0; s <= steps; s++) {
				const t = s / steps;
				const col = Math.floor(ax + (bx - ax) * t);
				const row = Math.floor(ay + (by - ay) * t);
				if (col >= 0 && row >= 0 && col < width && row < height) {
					mask[row * width + col] = 1;
				}
			}
		}
	}
	return mask;
}

function flood(crop: Uint8Array, width: number, height: number): number[][] {
	const seen = new Uint8Array(crop.length);
	const groups: number[][] = [];
	const stack: number[] = [];
	for (let start = 0; start < crop.length; start++) {
		if (!crop[start] || seen[start]) continue;
		const cells: number[] = [];
		stack.push(start);
		seen[start] = 1;
		while (stack.length > 0) {
			const p = stack.pop();
			if (p === undefined) break;
			cells.push(p);
			const col = p % width;
			const row = (p - col) / width;
			const neighbors = [col + 1, col - 1, col, col];
			const rows = [row, row, row + 1, row - 1];
			for (let n = 0; n < 4; n++) {
				const nc = neighbors[n];
				const nr = rows[n];
				if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
				const q = nr * width + nc;
				if (!crop[q] || seen[q]) continue;
				seen[q] = 1;
				stack.push(q);
			}
		}
		groups.push(cells);
	}
	return groups;
}

function pieceOf(cells: number[], cellKm2: number): Piece {
	let minCell = cells[0] ?? 0;
	for (const p of cells) if (p < minCell) minCell = p;
	return { cells, minCell, areaKm2: cells.length * cellKm2 };
}

function splitLarge(piece: Piece, width: number, cellKm2: number): Piece[] {
	if (piece.areaKm2 <= SPLIT_KM2) return [piece];
	const buckets = new Map<number, number[]>();
	for (const p of piece.cells) {
		const col = p % width;
		const row = (p - col) / width;
		const key =
			Math.floor(row / TILE_CELLS) * 1_000_000 + Math.floor(col / TILE_CELLS);
		const bucket = buckets.get(key);
		if (bucket) bucket.push(p);
		else buckets.set(key, [p]);
	}
	const out: Piece[] = [];
	for (const cells of buckets.values()) {
		const next = pieceOf(cells, cellKm2);
		if (next.areaKm2 >= MIN_ZONE_KM2) out.push(next);
	}
	return out;
}

/** Parches 4-conexos de Cultivos, con el corte de los bloques enormes. */
export function buildZones(
	landcover: ArrayLike<number>,
	width: number,
	height: number,
	cellSizeM: number,
	barriers: Uint8Array,
): AgriMap {
	const crop = new Uint8Array(width * height);
	for (let p = 0; p < crop.length; p++) {
		crop[p] = landcover[p] === CROP_CLASS && !barriers[p] ? 1 : 0;
	}
	const cellKm2 = (cellSizeM * cellSizeM) / 1e6;
	const pieces: Piece[] = [];
	for (const cells of flood(crop, width, height)) {
		const piece = pieceOf(cells, cellKm2);
		if (piece.areaKm2 < MIN_ZONE_KM2) continue;
		pieces.push(...splitLarge(piece, width, cellKm2));
	}
	pieces.sort((a, b) => b.areaKm2 - a.areaKm2 || a.minCell - b.minCell);
	const owner = new Int32Array(width * height).fill(-1);
	const zones: AgriZone[] = pieces.map((piece, id) => {
		let col = 0;
		let row = 0;
		for (const p of piece.cells) {
			owner[p] = id;
			col += (p % width) + 0.5;
			row += (p - (p % width)) / width + 0.5;
		}
		const n = piece.cells.length;
		return {
			id,
			areaKm2: piece.areaKm2,
			cells: piece.cells,
			minCell: piece.minCell,
			col: col / n,
			row: row / n,
		};
	});
	return { zones, owner };
}

export function listedZones(zones: AgriZone[], cap = LIST_CAP) {
	return {
		listed: zones.slice(0, cap),
		omitted: zones.length > cap,
	};
}

/** Zona válida bajo el toque. Un cultivo demasiado chico o fuera de Cultivos no elige nada. */
export function zoneAt(
	map: AgriMap,
	landcover: ArrayLike<number>,
	width: number,
	col: number,
	row: number,
): AgriZone | null {
	const i = Math.floor(col);
	const j = Math.floor(row);
	if (i < 0 || j < 0 || i >= width) return null;
	const p = j * width + i;
	if (landcover[p] !== CROP_CLASS) return null;
	const id = map.owner[p];
	if (id < 0) return null;
	return map.zones[id] ?? null;
}

/** 0 fuera de una zona, 1 en una zona válida, 2 en la zona elegida. */
export function cropMask(
	owner: Int32Array,
	selectedId: number | null,
): Uint8Array {
	const mask = new Uint8Array(owner.length);
	for (let i = 0; i < owner.length; i++) {
		const id = owner[i];
		if (id < 0) continue;
		mask[i] = selectedId !== null && id === selectedId ? 2 : 1;
	}
	return mask;
}

/** 1 en las celdas de la zona que tienen un vecino fuera de ella. */
export function outlineMask(
	cells: number[],
	width: number,
	height: number,
): Uint8Array {
	const inside = new Uint8Array(width * height);
	for (const p of cells) inside[p] = 1;
	const mask = new Uint8Array(width * height);
	for (const p of cells) {
		const col = p % width;
		const row = (p - col) / width;
		const edge =
			col === 0 ||
			!inside[p - 1] ||
			col === width - 1 ||
			!inside[p + 1] ||
			row === 0 ||
			!inside[p - width] ||
			row === height - 1 ||
			!inside[p + width];
		if (edge) mask[p] = 1;
	}
	return mask;
}

export function moistureSeries(
	cells: number[],
	cube: Int16Array | null,
	dateCount: number,
	plane: number,
	scale: number,
	nodata: number,
): Array<number | null> {
	const out: Array<number | null> = [];
	for (let t = 0; t < dateCount; t++) {
		if (!cube) {
			out.push(null);
			continue;
		}
		let sum = 0;
		let n = 0;
		const base = t * plane;
		for (const p of cells) {
			const raw = cube[base + p];
			if (raw === nodata) continue;
			sum += raw * scale;
			n++;
		}
		out.push(n > 0 ? sum / n : null);
	}
	return out;
}

export type VegWord = "más intensa" | "más débil" | "parecida";
export type ChangeWord =
	| "señal más fuerte"
	| "señal más débil"
	| "sin cambio dominante";
export type DisturbWord = "la superficie se disturbó" | "sin disturbio marcado";

function meanAt(
	cells: number[],
	cube: Int16Array,
	dateIndex: number,
	plane: number,
	scale: number,
	nodata: number,
): number | null {
	let sum = 0;
	let n = 0;
	const base = dateIndex * plane;
	for (const p of cells) {
		const raw = cube[base + p];
		if (raw === nodata) continue;
		sum += raw * scale;
		n++;
	}
	return n > 0 ? sum / n : null;
}

export function vegetationWord(
	cells: number[],
	cube: Int16Array | null,
	dateIndex: number,
	plane: number,
	scale: number,
	nodata: number,
): VegWord | null {
	if (!cube) return null;
	const first = meanAt(cells, cube, 0, plane, scale, nodata);
	const now = meanAt(cells, cube, dateIndex, plane, scale, nodata);
	if (first === null || now === null) return null;
	const delta = now - first;
	if (delta > HV_DELTA_DB) return "más intensa";
	if (delta < -HV_DELTA_DB) return "más débil";
	return "parecida";
}

function classShare(
	cells: number[],
	cube: Uint8Array,
	dateIndex: number,
	plane: number,
	nodata: number,
	value: number,
): { share: number; valid: number } | null {
	let valid = 0;
	let hits = 0;
	const base = dateIndex * plane;
	for (const p of cells) {
		const raw = cube[base + p];
		if (raw === nodata) continue;
		valid++;
		if (raw === value) hits++;
	}
	if (valid === 0) return null;
	return { share: hits / valid, valid };
}

export function changeWord(
	cells: number[],
	cube: Uint8Array | null,
	dateIndex: number,
	plane: number,
	nodata = 0,
): ChangeWord | null {
	if (!cube) return null;
	const up = classShare(cells, cube, dateIndex, plane, nodata, 2);
	const down = classShare(cells, cube, dateIndex, plane, nodata, 3);
	if (!up || !down) return null;
	if (up.share >= SIGNAL_SHARE && up.share > down.share) {
		return "señal más fuerte";
	}
	if (down.share >= SIGNAL_SHARE && down.share > up.share) {
		return "señal más débil";
	}
	return "sin cambio dominante";
}

export function disturbanceWord(
	cells: number[],
	cube: Uint8Array | null,
	dateIndex: number,
	plane: number,
	nodata = 0,
): DisturbWord | null {
	if (!cube) return null;
	const hit = classShare(cells, cube, dateIndex, plane, nodata, 2);
	if (!hit) return null;
	return hit.share >= SIGNAL_SHARE
		? "la superficie se disturbó"
		: "sin disturbio marcado";
}

/** La zona elegida ocupa un lugar. Una cuarta zona distinta no entra. */
export function withComparison(
	selected: number,
	extras: number[],
	candidate: number,
): { extras: number[]; rejected: boolean } {
	if (candidate === selected || extras.includes(candidate)) {
		return { extras, rejected: false };
	}
	if (1 + extras.length >= MAX_COMPARE) return { extras, rejected: true };
	return { extras: [...extras, candidate], rejected: false };
}

export function alignSeries(
	groups: Array<{ dates: string[]; values: Array<number | null> }>,
): { dates: string[]; columns: Array<Array<number | null>> } {
	const dates = [...new Set(groups.flatMap((g) => g.dates))].sort();
	const columns = groups.map((group) =>
		dates.map((date) => {
			const index = group.dates.indexOf(date);
			return index < 0 ? null : (group.values[index] ?? null);
		}),
	);
	return { dates, columns };
}

export interface WaySource {
	id: string;
	kind: "canal" | "river";
	features: Feature[];
	segments: Segment[];
}

export interface WayHit {
	overlayId: string;
	kind: "canal" | "river";
	/** null cuando la vía no trae nombre. */
	name: string | null;
	distanceM: number;
	feature: number;
}

function pointSegmentDistance(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
) {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	const t =
		len2 === 0
			? 0
			: Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function nearestWaterway(
	cells: number[],
	width: number,
	cellSizeM: number,
	sources: WaySource[],
): WayHit | null {
	let best: WayHit | null = null;
	let bestCells = WATERWAY_MAX_M / cellSizeM;
	for (const source of sources) {
		for (const segment of source.segments) {
			let dist = bestCells;
			for (const p of cells) {
				const col = (p % width) + 0.5;
				const row = (p - (p % width)) / width + 0.5;
				const d = pointSegmentDistance(
					col,
					row,
					segment.a[0],
					segment.a[1],
					segment.b[0],
					segment.b[1],
				);
				if (d < dist) dist = d;
			}
			if (dist < bestCells) {
				bestCells = dist;
				const feature = source.features[segment.feature];
				const name = feature?.name.trim() ?? "";
				best = {
					overlayId: source.id,
					kind: source.kind,
					name: name || null,
					distanceM: dist * cellSizeM,
					feature: segment.feature,
				};
			}
		}
	}
	return best;
}

/** 2 marca los tramos de la vía elegida; el 1 de hundimiento se conserva en el resto. */
export function paintWayFlags(
	base: Uint8Array,
	segments: Segment[],
	feature: number | null,
): Uint8Array {
	if (feature === null) return base;
	const out = new Uint8Array(base);
	segments.forEach((segment, index) => {
		if (segment.feature === feature) out[index] = 2;
	});
	return out;
}

export interface WaterTouch {
	permanent: boolean;
	fresh: boolean;
}

export function waterBeside(
	cells: number[],
	plane: Uint8Array | null,
	width: number,
	height: number,
): WaterTouch {
	const touch: WaterTouch = { permanent: false, fresh: false };
	if (!plane) return touch;
	const seen = new Uint8Array(width * height);
	for (const p of cells) {
		const col = p % width;
		const row = (p - col) / width;
		for (let dj = -WATER_RING; dj <= WATER_RING; dj++) {
			for (let di = -WATER_RING; di <= WATER_RING; di++) {
				const nc = col + di;
				const nr = row + dj;
				if (nc < 0 || nr < 0 || nc >= width || nr >= height) continue;
				const q = nr * width + nc;
				if (seen[q]) continue;
				seen[q] = 1;
				if (plane[q] === 2) touch.permanent = true;
				if (plane[q] === 3) touch.fresh = true;
			}
		}
	}
	return touch;
}

export function noWayText(searchedRivers: boolean): string {
	return searchedRivers
		? "No hay canal ni río a menos de 2 km."
		: "No hay un canal a menos de 2 km.";
}

export function waterLines(
	hit: WayHit | null,
	touch: WaterTouch,
	searchedRivers: boolean,
): string[] {
	const lines: string[] = [];
	if (hit) {
		const kind = hit.kind === "river" ? "Río" : "Canal";
		const name = hit.name ?? "sin nombre";
		lines.push(
			`${kind} ${name}, a ${hit.distanceM < 1000 ? `${Math.round(hit.distanceM)} m` : `${(hit.distanceM / 1000).toFixed(1)} km`}.`,
		);
	} else {
		lines.push(noWayText(searchedRivers));
	}
	if (touch.permanent) lines.push("Agua permanente en la zona o junto a ella.");
	if (touch.fresh) lines.push("Agua nueva en la zona o junto a ella.");
	if (!touch.permanent && !touch.fresh) {
		lines.push("No hay cuerpo de agua medido en la zona en esta fecha.");
	}
	if (hit || touch.permanent || touch.fresh) lines.push(AGRI_COPY.proximity);
	return lines;
}
