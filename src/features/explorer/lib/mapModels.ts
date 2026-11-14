/**
 * Dónde sentar modelos 3D en la grilla. No conoce Three: solo posiciones.
 * El cultivo es la clase Cultivos (no hay tipo de cultivo en los datos).
 * Casas y edificios salen de la zona urbana. Los autos, de las vías.
 */
import type { Feature } from "./infrastructure";

export const CROP_CLASS = 5;
export const URBAN_CLASS = 6;

export type MapModelKind = "crop" | "house" | "building" | "car";

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

const MAX_CROP = 1600;
const MAX_URBAN = 700;
const MAX_CARS = 420;
const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary"]);

function hash(n: number) {
	let x = n | 0;
	x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
	x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
	return (x ^ (x >>> 16)) >>> 0;
}

function onLand(
	landcover: ArrayLike<number>,
	width: number,
	height: number,
	klass: number,
	stride: number,
	limit: number,
	make: (cell: number, h: number, col: number, row: number) => MapModel,
) {
	const out: MapModel[] = [];
	for (let row = 0; row < height && out.length < limit; row += stride) {
		for (let col = 0; col < width && out.length < limit; col += stride) {
			const cell = row * width + col;
			if (landcover[cell] !== klass) continue;
			out.push(make(cell, hash(cell), col, row));
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
	const cropStride = input.cropStride ?? 8;
	const urbanStride = input.urbanStride ?? 7;
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
					(_cell, h, col, row) => ({
						kind: "crop",
						col: col + 0.5 + ((h & 7) - 3) * 0.15,
						row: row + 0.5 + (((h >> 3) & 7) - 3) * 0.15,
						yaw: (h % 628) / 100,
						scale: 0.85 + (h % 50) / 100,
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
					(_cell, h, col, row) => ({
						kind: (h & 3) === 0 ? "building" : "house",
						col: col + 0.5,
						row: row + 0.5,
						yaw: ((h >> 4) % 4) * (Math.PI / 2),
						scale: 0.8 + ((h >> 8) % 50) / 100,
					}),
				)
			: [];
	const cars = input.cars ? placeCars(input.roads, carStep, MAX_CARS) : [];
	return [...crops, ...settlements, ...cars];
}
