/** Caminos y canales sobre las zonas de cambio. Lógica pura. */
import { Band } from "./impact";

export interface Feature {
	name: string;
	class: string;
	points: Array<[number, number]>;
}

export interface Segment {
	feature: number;
	a: [number, number];
	b: [number, number];
	/** Largo en km. */
	km: number;
}

export function toSegments(features: Feature[], cellSizeM: number): Segment[] {
	const out: Segment[] = [];
	features.forEach((f, feature) => {
		for (let k = 1; k < f.points.length; k++) {
			const a = f.points[k - 1];
			const b = f.points[k];
			const km = (Math.hypot(a[0] - b[0], a[1] - b[1]) * cellSizeM) / 1000;
			out.push({ feature, a, b, km });
		}
	});
	return out;
}

/** Tramos cuyo punto medio cae en zona de hundimiento o con diferencial alto. */
export function affectedSegments(
	segments: Segment[],
	width: number,
	height: number,
	bands: Uint8Array | null,
	differential: Float32Array | null,
	differentialCut: number,
): { flags: Uint8Array; km: number } {
	const flags = new Uint8Array(segments.length);
	let km = 0;
	segments.forEach((s, i) => {
		const col = Math.floor((s.a[0] + s.b[0]) / 2);
		const row = Math.floor((s.a[1] + s.b[1]) / 2);
		if (col < 0 || row < 0 || col >= width || row >= height) return;
		const p = row * width + col;
		const inZone = (bands?.[p] ?? 0) >= Band.LOW;
		const bent = (differential?.[p] ?? 0) >= differentialCut;
		if (inZone || bent) {
			flags[i] = 1;
			km += s.km;
		}
	});
	return { flags, km };
}

/** Tramo más cercano a un punto, si está a menos de `maxCells`. */
export function nearestSegment(
	segments: Segment[],
	col: number,
	row: number,
	maxCells = 3,
): Segment | null {
	let best: Segment | null = null;
	let bestDist = maxCells;
	for (const s of segments) {
		const dx = s.b[0] - s.a[0];
		const dy = s.b[1] - s.a[1];
		const len2 = dx * dx + dy * dy;
		const t =
			len2 === 0
				? 0
				: Math.min(
						1,
						Math.max(0, ((col - s.a[0]) * dx + (row - s.a[1]) * dy) / len2),
					);
		const d = Math.hypot(col - (s.a[0] + t * dx), row - (s.a[1] + t * dy));
		if (d < bestDist) {
			bestDist = d;
			best = s;
		}
	}
	return best;
}

export interface Arrow {
	col: number;
	row: number;
	/** cm/año; positivo = hacia el este. */
	value: number;
}

/** Flechas por bloques: mediana de cada bloque de `step` celdas sobre el mínimo. */
export function arrowGrid(
	field: Float32Array,
	width: number,
	height: number,
	step: number,
	minValue = 0.5,
): Arrow[] {
	const out: Arrow[] = [];
	for (let j = 0; j + step <= height; j += step) {
		for (let i = 0; i + step <= width; i += step) {
			const vals: number[] = [];
			for (let y = j; y < j + step; y += 2) {
				for (let x = i; x < i + step; x += 2) {
					const v = field[y * width + x];
					if (Number.isFinite(v)) vals.push(v);
				}
			}
			if (vals.length < (step * step) / 16) continue;
			vals.sort((a, b) => a - b);
			const value = vals[vals.length >> 1];
			if (Math.abs(value) >= minValue) {
				out.push({ col: i + step / 2, row: j + step / 2, value });
			}
		}
	}
	return out;
}

/** Densidad de flechas según el zoom: de cerca, más flechas. */
export const arrowStep = (zoom: number) => (zoom > 6 ? 12 : zoom > 3 ? 24 : 48);
