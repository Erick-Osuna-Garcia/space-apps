/** Agua del mapa: máscara por fecha y ondas. Lógica pura. */

export const WaterClass = { PERMANENT: 2, NEW: 3 } as const;

/** Desde este valor (0–255) una celda ya se dibuja como agua. Igual que en el shader. */
export const WATER_THRESHOLD = 0.3 * 255;

const KERNEL = [1, 2, 1];

function blurPlane(
	src: Float32Array,
	width: number,
	height: number,
	out: Uint8Array,
	start: number,
) {
	const horizontal = new Float32Array(src.length);
	for (let r = 0; r < height; r++) {
		for (let c = 0; c < width; c++) {
			let sum = 0;
			for (let k = -1; k <= 1; k++) {
				const x = c + k;
				if (x >= 0 && x < width) sum += src[r * width + x] * KERNEL[k + 1];
			}
			horizontal[r * width + c] = sum;
		}
	}
	for (let r = 0; r < height; r++) {
		for (let c = 0; c < width; c++) {
			let sum = 0;
			for (let k = -1; k <= 1; k++) {
				const y = r + k;
				if (y >= 0 && y < height)
					sum += horizontal[y * width + c] * KERNEL[k + 1];
			}
			out[start + (r * width + c) * 2] = Math.round((sum / 16) * 255);
		}
	}
}

/**
 * Máscara suavizada (R permanente, G nueva; dos bytes por celda). El suavizado da bordes
 * redondos y deja una celda aislada bajo `WATER_THRESHOLD`. Sin dato cuenta como sin agua.
 */
export function waterMask(
	cube: Uint8Array,
	width: number,
	height: number,
	dates: number,
) {
	const plane = width * height;
	const out = new Uint8Array(plane * dates * 2);
	const cells = new Float32Array(plane);
	for (let t = 0; t < dates; t++) {
		[WaterClass.PERMANENT, WaterClass.NEW].forEach((value, ch) => {
			for (let i = 0; i < plane; i++) {
				cells[i] = cube[t * plane + i] === value ? 1 : 0;
			}
			blurPlane(cells, width, height, out, t * plane * 2 + ch);
		});
	}
	return out;
}

/** Si en esa fecha la celda se dibuja como agua. */
export function isWaterAt(
	mask: Uint8Array,
	width: number,
	height: number,
	dateIndex: number,
	col: number,
	row: number,
) {
	const c = Math.floor(col);
	const r = Math.floor(row);
	if (c < 0 || r < 0 || c >= width || r >= height) return false;
	const i = (dateIndex * width * height + r * width + c) * 2;
	return mask[i] >= WATER_THRESHOLD || mask[i + 1] >= WATER_THRESHOLD;
}

/** Última medición de agua no posterior a la fecha; antes de la primera, la primera. */
export function waterDateIndex(dates: string[], date: string | null) {
	if (!date) return 0;
	let found = 0;
	for (let i = 0; i < dates.length; i++) if (dates[i] <= date) found = i;
	return found;
}

export const MAX_RIPPLES = 8;
export const RIPPLE_EVERY_S = 0.35;

export interface Ripples {
	/** col, fila y momento de nacimiento de cada onda. */
	items: Float32Array;
	next: number;
	lastShipRipple: number;
}

export function createRipples(): Ripples {
	const items = new Float32Array(MAX_RIPPLES * 3);
	for (let i = 2; i < items.length; i += 3) items[i] = -1e4;
	return { items, next: 0, lastShipRipple: -1e4 };
}

/** Agrega una onda; al llenarse reemplaza la más vieja. */
export function addRipple(r: Ripples, col: number, row: number, time: number) {
	r.items.set([col, row, time], r.next * 3);
	r.next = (r.next + 1) % MAX_RIPPLES;
}

/** La nave deja una onda cada cierto tiempo si se mueve sobre agua. */
export function shipRipple(
	r: Ripples,
	col: number,
	row: number,
	time: number,
	moving: boolean,
	overWater: boolean,
) {
	if (!moving || !overWater || time - r.lastShipRipple < RIPPLE_EVERY_S) {
		return false;
	}
	r.lastShipRipple = time;
	addRipple(r, col, row, time);
	return true;
}
