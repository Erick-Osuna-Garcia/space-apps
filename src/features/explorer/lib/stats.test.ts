import { describe, expect, it } from "vitest";
import { fillForDisplay, robustLimit, velocityField } from "./stats";

// 2x2, 3 fechas a 1 año de distancia; scale 0.1 (mm -> cm)
const info = {
	width: 2,
	height: 2,
	dates: ["2024-01-01", "2025-01-01", "2026-01-01"],
	scale: 0.1,
	nodata: -32768,
};
const ND = -32768;
// píxeles: p0 hunde 10 cm/año, p1 estable, p2 sin dato en t1, p3 todo nodata
const cube = Int16Array.from([
	0,
	0,
	0,
	ND, // t0
	-100,
	0,
	ND,
	ND, // t1
	-200,
	0,
	-60,
	ND, // t2
]);

describe("velocityField", () => {
	it("calcula cm/año por píxel e ignora nodata", () => {
		const v = velocityField(cube, info);
		expect(v[0]).toBeCloseTo(-10, 1);
		expect(v[1]).toBeCloseTo(0, 5);
		expect(v[2]).toBeCloseTo(-3, 1); // dos fechas válidas (0 y -6 cm en 2 años)
		expect(v[3]).toBeNaN();
	});
});

describe("robustLimit", () => {
	it("usa el percentil del valor absoluto", () => {
		const vals = Float32Array.from([1, -2, 3, Number.NaN, -100]);
		expect(robustLimit(vals, 0.5)).toBe(3);
		expect(robustLimit(Float32Array.from([Number.NaN]))).toBe(1);
	});
});

describe("fillForDisplay", () => {
	it("rellena huecos pequeños con vecinos y deja los lejanos en NaN", () => {
		// 5x1: [ -10, ND, -20, ND, ND ]  una fecha
		const c = Int16Array.from([-100, ND, -200, ND, ND]);
		const i1 = {
			width: 5,
			height: 1,
			dates: ["2025-01-01"],
			scale: 0.1,
			nodata: ND,
		};
		const f = fillForDisplay(c, i1, 1);
		expect(f[0]).toBeCloseTo(-10);
		expect(f[1]).toBeCloseTo(-15); // promedio de vecinos
		expect(f[3]).toBeCloseTo(-20);
		expect(f[4]).toBeNaN(); // a 2 celdas: fuera del alcance de 1 pasada
	});
});
