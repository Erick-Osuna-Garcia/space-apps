import * as THREE from "three";
import { sampleBilinear } from "../lib/grid";
import type { Region } from "../manifest";

export const DEFAULT_EXAGGERATION = 3;
/** El mapa se ve este número de veces más grande que la nave. */
export const MAP_SCALE = 3;
/** Lado máximo de la malla en escritorio. El color de capa sigue en textura a resolución plena. */
export const DESKTOP_TERRAIN_SPAN = 480;
/** Lado máximo de la malla en móvil / táctil (riesgo del diseño: 256²). */
export const MOBILE_TERRAIN_SPAN = 256;
/** Altura de la nave sobre el relieve, en unidades de escena. */
export const HOVER_HEIGHT = 48 / MAP_SCALE;

/** Unidades de escena por metro de altura (1 unidad horizontal = 1 celda). */
export const verticalScale = (region: Region, exaggeration: number) =>
	exaggeration / region.cellSizeM;

/** Cada cuántas celdas hay un vértice. La capa se pinta por textura, no hace falta 1:1. */
export function terrainStep(width: number, height: number, compact: boolean) {
	const span = compact ? MOBILE_TERRAIN_SPAN : DESKTOP_TERRAIN_SPAN;
	return Math.max(1, Math.ceil(Math.max(width, height) / span));
}

/** Altura del relieve en unidades de escena, sin hundimiento 3D. */
export function baseHeightFn(
	region: Region,
	heights: Int16Array,
	exaggeration: number,
) {
	const vs = verticalScale(region, exaggeration);
	const { width, height } = region;
	return (col: number, row: number) =>
		sampleBilinear(heights, width, height, col, row) * vs;
}

// Tinte hipsométrico estilizado para el desierto de Baja California.
const HYPSO: Array<[number, [number, number, number]]> = [
	[-50, [0.78, 0.72, 0.58]],
	[40, [0.84, 0.77, 0.6]],
	[250, [0.76, 0.63, 0.45]],
	[600, [0.6, 0.48, 0.38]],
	[1000, [0.52, 0.45, 0.42]],
	[1600, [0.74, 0.71, 0.68]],
];
const WATER: [number, number, number] = [0.16, 0.34, 0.46];

export function hypsoColor(h: number): [number, number, number] {
	if (h <= HYPSO[0][0]) return HYPSO[0][1];
	for (let i = 1; i < HYPSO.length; i++) {
		const [h1, c1] = HYPSO[i];
		if (h <= h1) {
			const [h0, c0] = HYPSO[i - 1];
			const f = (h - h0) / (h1 - h0);
			return [
				c0[0] + (c1[0] - c0[0]) * f,
				c0[1] + (c1[1] - c0[1]) * f,
				c0[2] + (c1[2] - c0[2]) * f,
			];
		}
	}
	return HYPSO[HYPSO.length - 1][1];
}

export interface TerrainBuild {
	surface: THREE.BufferGeometry;
	skirt: THREE.BufferGeometry;
	baseY: number;
}

/**
 * Malla del terreno en los centros de celda. `step` > 1 decima (móviles).
 * El atributo `gridUv` apunta al centro de texel de la celda para muestrear las capas.
 * El mar (alturas exactamente 0 sin tesela DEM) se pinta como agua.
 */
export function buildTerrain(
	region: Region,
	heights: Int16Array,
	exaggeration: number,
	step = 1,
): TerrainBuild {
	const { width: W, height: H } = region;
	const vs = verticalScale(region, exaggeration);
	const cols = Math.floor((W - 1) / step) + 1;
	const rows = Math.floor((H - 1) / step) + 1;
	const n = cols * rows;
	const pos = new Float32Array(n * 3);
	const uv = new Float32Array(n * 2);
	const color = new Float32Array(n * 3);
	let minY = Number.POSITIVE_INFINITY;

	for (let r = 0; r < rows; r++) {
		const j = Math.min(r * step, H - 1);
		for (let c = 0; c < cols; c++) {
			const i = Math.min(c * step, W - 1);
			const h = heights[j * W + i];
			const k = r * cols + c;
			const y = h * vs;
			pos.set([i + 0.5, y, j + 0.5], k * 3);
			uv.set([(i + 0.5) / W, (j + 0.5) / H], k * 2);
			color.set(h === 0 ? WATER : hypsoColor(h), k * 3);
			if (y < minY) minY = y;
		}
	}

	const index = new Uint32Array((cols - 1) * (rows - 1) * 6);
	let t = 0;
	for (let r = 0; r < rows - 1; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const a = r * cols + c;
			const b = a + 1;
			const d = a + cols;
			const e = d + 1;
			index.set([a, d, b, b, d, e], t);
			t += 6;
		}
	}

	const surface = new THREE.BufferGeometry();
	surface.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	surface.setAttribute("gridUv", new THREE.BufferAttribute(uv, 2));
	surface.setAttribute("color", new THREE.BufferAttribute(color, 3));
	surface.setIndex(new THREE.BufferAttribute(index, 1));
	surface.computeVertexNormals();
	surface.computeBoundingSphere();

	// Faldón del diorama: paredes desde el borde del terreno hasta una base plana.
	const baseY = minY - 12;
	const edge: number[] = [];
	for (let c = 0; c < cols; c++) edge.push(c); // norte
	for (let r = 1; r < rows; r++) edge.push(r * cols + cols - 1); // este
	for (let c = cols - 2; c >= 0; c--) edge.push((rows - 1) * cols + c); // sur
	for (let r = rows - 2; r > 0; r--) edge.push(r * cols); // oeste
	edge.push(edge[0]);
	const skirtPos = new Float32Array(edge.length * 2 * 3);
	edge.forEach((k, m) => {
		const x = pos[k * 3];
		const y = pos[k * 3 + 1];
		const z = pos[k * 3 + 2];
		skirtPos.set([x, y, z, x, baseY, z], m * 6);
	});
	const skirtIdx: number[] = [];
	for (let m = 0; m < edge.length - 1; m++) {
		const a = m * 2;
		skirtIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
	}
	const skirt = new THREE.BufferGeometry();
	skirt.setAttribute("position", new THREE.BufferAttribute(skirtPos, 3));
	skirt.setIndex(skirtIdx);
	skirt.computeVertexNormals();

	return { surface, skirt, baseY };
}
