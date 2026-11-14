/**
 * Dónde sentar modelos 3D en la grilla. No conoce Three: solo posiciones.
 * El cultivo es la clase Cultivos (no hay tipo de cultivo en los datos).
 * Casas y edificios salen de la zona urbana. Los autos, de las vías.
 */
import type { Feature } from "./infrastructure";

export const CROP_CLASS = 5;
export const URBAN_CLASS = 6;

/** Variantes del valle. El peso reparte los grupos; no sale de una capa por parcela. */
export const CROP_VARIANTS = [
	{ id: "trigo", label: "Trigo", weight: 5 },
	{ id: "algodon", label: "Algodón", weight: 3 },
	{ id: "alfalfa", label: "Alfalfa", weight: 5 },
	{ id: "cebollin", label: "Cebollín", weight: 3 },
	{ id: "esparrago", label: "Espárrago", weight: 2 },
	{ id: "sorgo", label: "Sorgo", weight: 2 },
	{ id: "cebolla", label: "Cebolla", weight: 2 },
	{ id: "col", label: "Col de Bruselas", weight: 1 },
	{ id: "cilantro", label: "Cilantro", weight: 1 },
	{ id: "espinaca", label: "Espinaca", weight: 1 },
	{ id: "brocoli", label: "Brócoli", weight: 1 },
	{ id: "lechuga", label: "Lechuga", weight: 1 },
	{ id: "pepino", label: "Pepino", weight: 1 },
	{ id: "tomatillo", label: "Tomatillo", weight: 1 },
	{ id: "nogal", label: "Nogal", weight: 1 },
	{ id: "olivo", label: "Olivo", weight: 1 },
	{ id: "vid", label: "Vid", weight: 1 },
	{ id: "durazno", label: "Durazno", weight: 1 },
	{ id: "higuera", label: "Higuera", weight: 1 },
	{ id: "datil", label: "Dátil", weight: 1 },
] as const;

export type CropId = (typeof CROP_VARIANTS)[number]["id"];
export type MapModelKind = CropId | "house" | "building" | "car";

const CROP_WEIGHT = CROP_VARIANTS.reduce(
	(sum, variant) => sum + variant.weight,
	0,
);

export function cropVariant(seed: number): CropId {
	let pick = seed % CROP_WEIGHT;
	for (const variant of CROP_VARIANTS) {
		if (pick < variant.weight) return variant.id;
		pick -= variant.weight;
	}
	return "trigo";
}

const CITY_SEARCH = 40;

/** Zona urbana conectada a la ciudad, 255 dentro y 0 fuera. */
export function urbanCityMask(
	landcover: ArrayLike<number>,
	width: number,
	height: number,
	col: number,
	row: number,
): Uint8Array | null {
	const mask = new Uint8Array(width * height);
	let seed = -1;
	const c0 = Math.floor(col);
	const r0 = Math.floor(row);
	for (let radius = 0; radius <= CITY_SEARCH && seed < 0; radius++) {
		for (let dr = -radius; dr <= radius && seed < 0; dr++) {
			for (let dc = -radius; dc <= radius; dc++) {
				if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
				const c = c0 + dc;
				const r = r0 + dr;
				if (c < 0 || r < 0 || c >= width || r >= height) continue;
				if (landcover[r * width + c] === URBAN_CLASS) {
					seed = r * width + c;
					break;
				}
			}
		}
	}
	if (seed < 0) return null;
	const queue = [seed];
	mask[seed] = 255;
	for (let i = 0; i < queue.length; i++) {
		const p = queue[i];
		if (p === undefined) continue;
		const c = p % width;
		const r = (p - c) / width;
		const next = [p - 1, p + 1, p - width, p + width];
		for (const n of next) {
			if (n < 0 || n >= mask.length || mask[n]) continue;
			const nc = n % width;
			const nr = (n - nc) / width;
			if (Math.abs(nc - c) + Math.abs(nr - r) !== 1) continue;
			if (landcover[n] !== URBAN_CLASS) continue;
			mask[n] = 255;
			queue.push(n);
		}
	}
	return mask;
}

export function isCropKind(kind: string): kind is CropId {
	return CROP_VARIANTS.some((variant) => variant.id === kind);
}

export interface MapModel {
	kind: MapModelKind;
	col: number;
	row: number;
	/** Radianes alrededor del eje vertical. */
	yaw: number;
	scale: number;
}

export interface PlaceMapModelsInput {
	landcover: ArrayLike<number> | null;
	width: number;
	height: number;
	roads: Feature[];
	/** Plantas sobre Cultivos. */
	crops: boolean;
	/** Casas y edificios sobre zona urbana. */
	settlements: boolean;
	cars: boolean;
	cropStride?: number;
	urbanStride?: number;
	/** Distancia entre autos, en celdas. */
	carStep?: number;
}

const MAX_CROP = 7000;
const MAX_URBAN = 3000;
const MAX_CARS = 420;
/** Vecindario con el que se decide si el grupo es de 1 o de hasta 5. */
const CLUSTER_RADIUS = 2;
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary"]);

function hash(n: number) {
	let x = n | 0;
	x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
	x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
	return (x ^ (x >>> 16)) >>> 0;
}

/** 1 si el alrededor casi no es de la clase; 5 si el bloque está lleno. */
function clusterSize(
	landcover: ArrayLike<number>,
	width: number,
	height: number,
	col: number,
	row: number,
	klass: number,
) {
	let same = 0;
	let seen = 0;
	for (let dr = -CLUSTER_RADIUS; dr <= CLUSTER_RADIUS; dr++) {
		for (let dc = -CLUSTER_RADIUS; dc <= CLUSTER_RADIUS; dc++) {
			const c = col + dc;
			const r = row + dr;
			if (c < 0 || r < 0 || c >= width || r >= height) continue;
			seen++;
			if (landcover[r * width + c] === klass) same++;
		}
	}
	if (seen === 0) return 1;
	return 1 + Math.min(4, Math.floor((same / seen) * 4));
}

function ring(count: number, h: number, spread: number) {
	const points: Array<[number, number]> = [];
	for (let i = 0; i < count; i++) {
		if (count === 1) {
			points.push([0, 0]);
			break;
		}
		const angle = (i / count) * Math.PI * 2 + (h % 19) * 0.01;
		const radius = spread * (0.65 + (i % 2) * 0.35);
		points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
	}
	return points;
}

function onLand(
	landcover: ArrayLike<number>,
	width: number,
	height: number,
	klass: number,
	stride: number,
	limit: number,
	spread: number,
	make: (
		anchorHash: number,
		memberHash: number,
	) => Omit<MapModel, "col" | "row">,
) {
	const anchors: Array<{
		col: number;
		row: number;
		h: number;
		count: number;
	}> = [];
	for (let row = 0; row < height; row += stride) {
		for (let col = 0; col < width; col += stride) {
			if (landcover[row * width + col] !== klass) continue;
			anchors.push({
				col,
				row,
				h: hash(row * width + col),
				count: clusterSize(landcover, width, height, col, row, klass),
			});
		}
	}
	const wanted = anchors.reduce((sum, anchor) => sum + anchor.count, 0);
	const keep = wanted <= limit ? 1 : Math.ceil(wanted / limit);
	const out: MapModel[] = [];
	for (let i = 0; i < anchors.length && out.length < limit; i += keep) {
		const anchor = anchors[i];
		if (!anchor) continue;
		const points = ring(anchor.count, anchor.h, spread);
		for (let k = 0; k < points.length && out.length < limit; k++) {
			const point = points[k];
			if (!point) continue;
			const body = make(anchor.h, anchor.h + k * 17);
			out.push({
				...body,
				col: anchor.col + 0.5 + point[0],
				row: anchor.row + 0.5 + point[1],
			});
		}
	}
	return out;
}

function placeCars(roads: Feature[], step: number, limit: number) {
	const out: MapModel[] = [];
	for (const road of roads) {
		if (!ROAD_CLASSES.has(road.class)) continue;
		let pending = step * 0.5;
		for (let k = 1; k < road.points.length && out.length < limit; k++) {
			const [ax, ay] = road.points[k - 1];
			const [bx, by] = road.points[k];
			const len = Math.hypot(bx - ax, by - ay);
			if (len < 1e-4) continue;
			let dist = pending;
			while (dist <= len && out.length < limit) {
				const t = dist / len;
				out.push({
					kind: "car",
					col: ax + (bx - ax) * t,
					row: ay + (by - ay) * t,
					yaw: Math.atan2(-(by - ay), bx - ax),
					scale: 1,
				});
				dist += step;
			}
			pending = dist - len;
		}
	}
	return out;
}

export function placeMapModels(input: PlaceMapModelsInput): MapModel[] {
	const cropStride = input.cropStride ?? 5;
	const urbanStride = input.urbanStride ?? 5;
	const carStep = input.carStep ?? 22;
	const land = input.landcover;
	const crops =
		input.crops && land
			? onLand(
					land,
					input.width,
					input.height,
					CROP_CLASS,
					cropStride,
					MAX_CROP,
					0.42,
					(anchorHash, memberHash) => ({
						kind: cropVariant(anchorHash),
						yaw: (memberHash % 628) / 100,
						scale: 0.85 + (memberHash % 50) / 100,
					}),
				)
			: [];
	const settlements =
		input.settlements && land
			? onLand(
					land,
					input.width,
					input.height,
					URBAN_CLASS,
					urbanStride,
					MAX_URBAN,
					0.7,
					(_anchorHash, memberHash) => ({
						kind: (memberHash & 3) === 0 ? "building" : "house",
						yaw: ((memberHash >> 4) % 4) * (Math.PI / 2),
						scale: 0.8 + ((memberHash >> 8) % 50) / 100,
					}),
				)
			: [];
	const cars = input.cars ? placeCars(input.roads, carStep, MAX_CARS) : [];
	return [...crops, ...settlements, ...cars];
}
