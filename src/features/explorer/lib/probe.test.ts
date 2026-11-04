import { describe, expect, it } from "vitest";
import { linearRate, readSeries } from "./probe";

const region = { width: 2, height: 2 };
const layer = {
	dates: ["2025-01-01", "2026-01-01"],
	scale: 0.1,
	nodata: -32768,
};
// t0: [0, 0, 0, 0]; t1: [-100, -32768, 5, 0]  (mm)
const cube = Int16Array.from([0, 0, 0, 0, -100, -32768, 5, 0]);

describe("readSeries", () => {
	it("lee la celda bajo el punto en cm", () => {
		expect(readSeries(cube, region, layer, 0.4, 0.4)).toEqual([0, -10]);
		expect(readSeries(cube, region, layer, 0.5, 1.5)).toEqual([0, 0.5]);
	});
	it("devuelve null en nodata", () => {
		expect(readSeries(cube, region, layer, 1.2, 0.2)).toEqual([0, null]);
	});
});

describe("linearRate", () => {
	it("estima cm/año", () => {
		const rate = linearRate([0, -10], ["2025-01-01", "2026-01-01"]);
		expect(rate).toBeCloseTo(-10, 0);
	});
	it("null si no hay suficientes puntos", () => {
		expect(linearRate([0, null], ["2025-01-01", "2026-01-01"])).toBeNull();
	});
});
