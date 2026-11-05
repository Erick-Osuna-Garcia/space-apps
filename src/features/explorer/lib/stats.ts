/**
 * Análisis de una capa de desplazamiento (design.md D12). Todo en el cliente a partir del cubo
 * Int16 (T×H×W, unidades × scale = cm, `nodata` = sin dato).
 */

export interface CubeInfo {
	width: number;
	height: number;
	dates: string[];
	scale: number;
	nodata: number;
}

const YEAR_MS = 365.25 * 86_400_000;

/**
 * Velocidad lineal por píxel (cm/año) por mínimos cuadrados sobre las fechas válidas.
 * NaN donde hay menos de 2 fechas con dato.
 */
export function velocityField(cube: Int16Array, info: CubeInfo): Float32Array {
	const plane = info.width * info.height;
	const t0 = Date.parse(info.dates[0]);
	const years = info.dates.map((d) => (Date.parse(d) - t0) / YEAR_MS);
	const out = new Float32Array(plane);
	for (let p = 0; p < plane; p++) {
		let n = 0;
		let sx = 0;
		let sy = 0;
		let sxx = 0;
		let sxy = 0;
		for (let t = 0; t < years.length; t++) {
			const raw = cube[t * plane + p];
			if (raw === info.nodata) continue;
			const x = years[t];
			const y = raw * info.scale;
			n++;
			sx += x;
			sy += y;
			sxx += x * x;
			sxy += x * y;
		}
		const den = n * sxx - sx * sx;
		out[p] = n >= 2 && den !== 0 ? (n * sxy - sx * sy) / den : Number.NaN;
	}
	return out;
}

/** Límite simétrico robusto: percentil `q` del valor absoluto (ignora NaN). */
export function robustLimit(values: Float32Array, q = 0.99): number {
	const abs: number[] = [];
	for (const v of values) if (Number.isFinite(v)) abs.push(Math.abs(v));
	if (abs.length === 0) return 1;
	abs.sort((a, b) => a - b);
	return Math.max(
		abs[Math.min(abs.length - 1, Math.floor(q * abs.length))],
		0.1,
	);
}

/**
 * Cubo (cm) para la GEOMETRÍA del hundimiento 3D: los huecos sin dato se rellenan con el
 * promedio de vecinos válidos por dilación iterativa (`passes` celdas de alcance), para no
 * crear paredes artificiales. Lo que queda sin rellenar es NaN (no se desplaza).
 * El color sigue usando el cubo original: estos valores nunca se muestran como dato.
 */
export function fillForDisplay(
	cube: Int16Array,
	info: CubeInfo,
	passes = 8,
): Float32Array {
	const { width: W, height: H } = info;
	const plane = W * H;
	const out = new Float32Array(cube.length);
	let cur = new Float32Array(plane);
	let next = new Float32Array(plane);
	for (let t = 0; t < info.dates.length; t++) {
		const base = t * plane;
		for (let p = 0; p < plane; p++) {
			const raw = cube[base + p];
			cur[p] = raw === info.nodata ? Number.NaN : raw * info.scale;
		}
		for (let pass = 0; pass < passes; pass++) {
			let changed = false;
			for (let j = 0; j < H; j++) {
				for (let i = 0; i < W; i++) {
					const p = j * W + i;
					const v = cur[p];
					if (!Number.isNaN(v)) {
						next[p] = v;
						continue;
					}
					let sum = 0;
					let n = 0;
					if (i > 0 && !Number.isNaN(cur[p - 1])) {
						sum += cur[p - 1];
						n++;
					}
					if (i < W - 1 && !Number.isNaN(cur[p + 1])) {
						sum += cur[p + 1];
						n++;
					}
					if (j > 0 && !Number.isNaN(cur[p - W])) {
						sum += cur[p - W];
						n++;
					}
					if (j < H - 1 && !Number.isNaN(cur[p + W])) {
						sum += cur[p + W];
						n++;
					}
					if (n > 0) {
						next[p] = sum / n;
						changed = true;
					} else next[p] = Number.NaN;
				}
			}
			[cur, next] = [next, cur];
			if (!changed) break;
		}
		out.set(cur, base);
	}
	return out;
}
