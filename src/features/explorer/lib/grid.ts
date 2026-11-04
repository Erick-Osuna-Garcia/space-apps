/**
 * Utilidades de grilla. Convención (igual que el pipeline):
 * - (col, row) fraccionarios con origen en la esquina NO de la celda NO; fila 0 = norte.
 * - El centro de la celda (i, j) está en (i + 0.5, j + 0.5).
 * - En la escena: x = col (este), z = row (sur), y = altura.
 */
import type { Region } from "../manifest";

export type Raster = ArrayLike<number>;

/** Muestreo bilineal en coordenadas de grilla; `nodata` en algún vecino -> NaN. */
export function sampleBilinear(
	data: Raster,
	width: number,
	height: number,
	col: number,
	row: number,
	nodata?: number,
	offset = 0,
): number {
	const x = Math.min(Math.max(col - 0.5, 0), width - 1);
	const y = Math.min(Math.max(row - 0.5, 0), height - 1);
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const x1 = Math.min(x0 + 1, width - 1);
	const y1 = Math.min(y0 + 1, height - 1);
	const fx = x - x0;
	const fy = y - y0;
	const a = data[offset + y0 * width + x0];
	const b = data[offset + y0 * width + x1];
	const c = data[offset + y1 * width + x0];
	const d = data[offset + y1 * width + x1];
	if (
		nodata !== undefined &&
		(a === nodata || b === nodata || c === nodata || d === nodata)
	) {
		return Number.NaN;
	}
	return (
		a * (1 - fx) * (1 - fy) +
		b * fx * (1 - fy) +
		c * (1 - fx) * fy +
		d * fx * fy
	);
}

/** Celda que contiene el punto (para lecturas exactas del cubo). */
export function cellIndex(
	width: number,
	height: number,
	col: number,
	row: number,
) {
	const i = Math.min(Math.max(Math.floor(col), 0), width - 1);
	const j = Math.min(Math.max(Math.floor(row), 0), height - 1);
	return j * width + i;
}

/** Mantiene un punto dentro de la grilla con un margen (en celdas). */
export function clampToGrid(
	col: number,
	row: number,
	width: number,
	height: number,
	margin = 0,
): { col: number; row: number; clamped: boolean } {
	const c = Math.min(Math.max(col, margin), width - margin);
	const r = Math.min(Math.max(row, margin), height - margin);
	return { col: c, row: r, clamped: c !== col || r !== row };
}

/** lon/lat de un punto de la grilla por interpolación bilineal de las esquinas. */
export function gridToLonLat(
	region: Region,
	col: number,
	row: number,
): [number, number] {
	const u = col / region.width;
	const v = row / region.height;
	const { nw, ne, sw, se } = region.corners;
	const lerp = (k: 0 | 1) =>
		nw[k] * (1 - u) * (1 - v) +
		ne[k] * u * (1 - v) +
		sw[k] * (1 - u) * v +
		se[k] * u * v;
	return [lerp(0), lerp(1)];
}

/**
 * Cámara isométrica con azimut 45° (situada en +x, +z mirando a -x, -z):
 * en pantalla "arriba" = (-1, -1)/√2 y "derecha" = (1, -1)/√2 en el plano (x, z).
 * Convierte ejes de entrada (derecha, adelante) en un vector de mundo (dx, dz) unitario.
 */
export function screenToWorld(
	right: number,
	forward: number,
): [number, number] {
	const s = Math.SQRT1_2;
	const dx = right * s - forward * s;
	const dz = -right * s - forward * s;
	const len = Math.hypot(dx, dz);
	return len > 1 ? [dx / len, dz / len] : [dx, dz];
}
