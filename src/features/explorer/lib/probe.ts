import type { Layer, Region } from "../manifest";
import { cellIndex } from "./grid";

/** Serie de tiempo (cm) de la celda bajo (col, row); `null` = sin dato. */
export function readSeries(
	cube: Int16Array,
	region: Pick<Region, "width" | "height">,
	layer: Pick<Layer, "dates" | "scale" | "nodata">,
	col: number,
	row: number,
): Array<number | null> {
	const plane = region.width * region.height;
	const idx = cellIndex(region.width, region.height, col, row);
	return layer.dates.map((_, t) => {
		const raw = cube[t * plane + idx];
		return raw === layer.nodata ? null : raw * layer.scale;
	});
}

/** Velocidad media (cm/año) por regresión lineal sobre la serie. */
export function linearRate(
	series: Array<number | null>,
	dates: string[],
): number | null {
	const pts: Array<[number, number]> = [];
	const t0 = Date.parse(dates[0]);
	series.forEach((v, i) => {
		if (v !== null)
			pts.push([(Date.parse(dates[i]) - t0) / (365.25 * 86_400_000), v]);
	});
	if (pts.length < 2) return null;
	const n = pts.length;
	const mx = pts.reduce((s, p) => s + p[0], 0) / n;
	const my = pts.reduce((s, p) => s + p[1], 0) / n;
	const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
	if (sxx === 0) return null;
	return pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx;
}
