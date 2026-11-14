/** Cintas de caminos y canales: geometría y estilo por tipo de vía. Lógica pura. */
import type { Feature } from "./infrastructure";

export interface RoadStyle {
	id: string;
	/** Medio ancho en celdas. */
	halfWidth: number;
	/** Se oculta al verse más de estas celdas de ancho; `Infinity` = siempre visible. */
	maxCells: number;
	color: string;
}

export const ROAD_STYLES: RoadStyle[] = [
	{ id: "motorway", halfWidth: 0.26, maxCells: Infinity, color: "#fcd34d" },
	{ id: "trunk", halfWidth: 0.2, maxCells: Infinity, color: "#fde68a" },
	{ id: "primary", halfWidth: 0.15, maxCells: 400, color: "#f1f5f9" },
	{ id: "secondary", halfWidth: 0.1, maxCells: 200, color: "#cbd5e1" },
	{ id: "canal", halfWidth: 0.13, maxCells: 400, color: "#38bdf8" },
	{ id: "river", halfWidth: 0.16, maxCells: 400, color: "#1d4ed8" },
];

const FALLBACK_CLASS = ROAD_STYLES.findIndex((s) => s.id === "secondary");
const FADE_START = 0.8;
const MITER_LIMIT = 2;

export const roadClass = (name: string) => {
	const i = ROAD_STYLES.findIndex((s) => s.id === name);
	return i < 0 ? FALLBACK_CLASS : i;
};

const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** Opacidad de una vía según el zoom; el shader de las cintas usa la misma fórmula. */
export function roadFade(cls: number, visibleCells: number, hit: boolean) {
	const { maxCells } = ROAD_STYLES[cls];
	if (hit || maxCells === Infinity) return 1;
	return 1 - smoothstep(maxCells * FADE_START, maxCells, visibleCells);
}

export interface Ribbon {
	/** Centro de la vía (col, altura base, fila), dos vértices por punto. */
	position: Float32Array;
	/** Dirección lateral en el plano, con el inglete incluido. */
	side: Float32Array;
	cls: Float32Array;
	/** Distancia recorrida en celdas. */
	along: Float32Array;
	/** Índice del tramo en `toSegments`, por vértice. */
	segment: Uint32Array;
	index: Uint32Array;
}

interface Point {
	col: number;
	row: number;
	segment: number;
}

function subdivide(f: Feature, firstSegment: number, stepCells: number) {
	const out: Point[] = [];
	for (let k = 1; k < f.points.length; k++) {
		const [ax, ay] = f.points[k - 1];
		const [bx, by] = f.points[k];
		const len = Math.hypot(bx - ax, by - ay);
		if (len === 0) continue;
		const segment = firstSegment + k - 1;
		if (out.length === 0) out.push({ col: ax, row: ay, segment });
		const n = Math.ceil(len / stepCells);
		for (let j = 1; j <= n; j++) {
			const t = j / n;
			out.push({ col: ax + (bx - ax) * t, row: ay + (by - ay) * t, segment });
		}
	}
	return out;
}

function unitNormal(a: Point, b: Point): [number, number] {
	const dx = b.col - a.col;
	const dz = b.row - a.row;
	const len = Math.hypot(dx, dz);
	return [-dz / len, dx / len];
}

/** Normal con inglete en un punto, para que la cinta no se abra en las curvas. */
function miter(prev: Point | null, p: Point, next: Point | null) {
	const n0 = prev ? unitNormal(prev, p) : null;
	const n1 = next ? unitNormal(p, next) : null;
	if (!n0 || !n1) return (n0 ?? n1) as [number, number];
	const mx = n0[0] + n1[0];
	const mz = n0[1] + n1[1];
	const len = Math.hypot(mx, mz);
	if (len < 1e-6) return n1; // la vía regresa sobre sí misma
	const ux = mx / len;
	const uz = mz / len;
	const scale = Math.min(1 / (ux * n1[0] + uz * n1[1]), MITER_LIMIT);
	return [ux * scale, uz * scale] as [number, number];
}

/** Cinta de todas las vías de una capa, subdividida para seguir el relieve. */
export function buildRibbon(
	features: Feature[],
	baseHeightAt: (col: number, row: number) => number,
	stepCells = 1,
): Ribbon {
	const position: number[] = [];
	const side: number[] = [];
	const cls: number[] = [];
	const along: number[] = [];
	const segment: number[] = [];
	const index: number[] = [];
	let firstSegment = 0;
	for (const f of features) {
		const points = subdivide(f, firstSegment, stepCells);
		firstSegment += Math.max(f.points.length - 1, 0);
		if (points.length < 2) continue;
		const c = roadClass(f.class);
		let distance = 0;
		points.forEach((p, i) => {
			const prev = points[i - 1] ?? null;
			const next = points[i + 1] ?? null;
			if (prev) distance += Math.hypot(p.col - prev.col, p.row - prev.row);
			const [sx, sz] = miter(prev, p, next);
			const y = baseHeightAt(p.col, p.row);
			const v = position.length / 3;
			position.push(p.col, y, p.row, p.col, y, p.row);
			side.push(sx, sz, -sx, -sz);
			cls.push(c, c);
			along.push(distance, distance);
			segment.push(p.segment, p.segment);
			if (next) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
		});
	}
	return {
		position: new Float32Array(position),
		side: new Float32Array(side),
		cls: new Float32Array(cls),
		along: new Float32Array(along),
		segment: new Uint32Array(segment),
		index: new Uint32Array(index),
	};
}

/** Resaltado por vértice a partir de los tramos afectados. */
export function ribbonHits(segment: Uint32Array, flags: Uint8Array) {
	const out = new Float32Array(segment.length);
	for (let i = 0; i < segment.length; i++) out[i] = flags[segment[i]] ?? 0;
	return out;
}
