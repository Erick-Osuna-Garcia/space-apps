/**
 * Escala divergente basada en "vik" (F. Crameri, Scientific colour maps; perceptualmente
 * uniforme y apta para daltonismo), aproximada con paradas. Azul = acercamiento al satélite,
 * claro = sin cambio, café rojizo = alejamiento (hundimiento).
 */
type Rgb = [number, number, number];

const VIK_STOPS: Array<[number, Rgb]> = [
	[0.0, [0.0, 0.071, 0.38]],
	[0.15, [0.016, 0.243, 0.514]],
	[0.3, [0.247, 0.49, 0.682]],
	[0.42, [0.647, 0.773, 0.851]],
	[0.5, [0.922, 0.914, 0.894]],
	[0.58, [0.875, 0.733, 0.592]],
	[0.7, [0.784, 0.506, 0.302]],
	[0.85, [0.6, 0.243, 0.071]],
	[1.0, [0.349, 0.0, 0.031]],
];

export function vik(t: number): Rgb {
	const x = Math.min(1, Math.max(0, t));
	for (let i = 1; i < VIK_STOPS.length; i++) {
		const [t1, c1] = VIK_STOPS[i];
		if (x <= t1) {
			const [t0, c0] = VIK_STOPS[i - 1];
			const f = (x - t0) / (t1 - t0);
			return [
				c0[0] + (c1[0] - c0[0]) * f,
				c0[1] + (c1[1] - c0[1]) * f,
				c0[2] + (c1[2] - c0[2]) * f,
			];
		}
	}
	return VIK_STOPS[VIK_STOPS.length - 1][1];
}

/** Rango simétrico alrededor de 0 para la escala divergente. */
export function symmetricLimit(valueRange: readonly [number, number]): number {
	return Math.max(Math.abs(valueRange[0]), Math.abs(valueRange[1]), 0.1);
}

/** Posición en la escala [0, 1] para un valor (negativo -> extremo cálido). */
export function valueToT(value: number, limit: number): number {
	return Math.min(1, Math.max(0, 0.5 - value / (2 * limit)));
}

/** LUT RGBA8 de `size` colores para subir como textura. */
export function colormapLut(size = 256): Uint8Array {
	const out = new Uint8Array(size * 4);
	for (let i = 0; i < size; i++) {
		const [r, g, b] = vik(i / (size - 1));
		out.set(
			[Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255],
			i * 4,
		);
	}
	return out;
}

export const toCss = ([r, g, b]: Rgb) =>
	`rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
