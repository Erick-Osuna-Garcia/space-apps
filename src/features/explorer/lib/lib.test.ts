import { describe, expect, it } from "vitest";
import type { Region } from "../manifest";
import { colormapLut, symmetricLimit, valueToT, vik } from "./colormap";
import {
	cellIndex,
	clampToGrid,
	gridToLonLat,
	sampleBilinear,
	screenToWorld,
} from "./grid";

describe("sampleBilinear", () => {
	// 3x2: fila 0 = [0, 10, 20], fila 1 = [30, 40, 50]
	const data = Int16Array.from([0, 10, 20, 30, 40, 50]);

	it("devuelve el valor exacto en centros de celda", () => {
		expect(sampleBilinear(data, 3, 2, 0.5, 0.5)).toBe(0);
		expect(sampleBilinear(data, 3, 2, 2.5, 1.5)).toBe(50);
	});

	it("interpola entre centros", () => {
		expect(sampleBilinear(data, 3, 2, 1.0, 0.5)).toBeCloseTo(5);
		expect(sampleBilinear(data, 3, 2, 1.5, 1.0)).toBeCloseTo(25);
	});

	it("se mantiene dentro de los bordes", () => {
		expect(sampleBilinear(data, 3, 2, -10, -10)).toBe(0);
		expect(sampleBilinear(data, 3, 2, 99, 99)).toBe(50);
	});

	it("propaga nodata y respeta el offset de banda", () => {
		const cube = Int16Array.from([1, 1, 1, 1, -32768, 7, 7, 7]);
		expect(sampleBilinear(cube, 2, 2, 1, 1, -32768, 4)).toBeNaN();
		expect(sampleBilinear(cube, 2, 2, 1.5, 1.5, -32768, 4)).toBe(7);
	});
});

describe("grilla", () => {
	it("cellIndex y clamp", () => {
		expect(cellIndex(3, 2, 2.9, 1.1)).toBe(5);
		expect(cellIndex(3, 2, -1, 9)).toBe(3);
		expect(clampToGrid(-1, 5, 10, 10, 1)).toEqual({
			col: 1,
			row: 5,
			clamped: true,
		});
		expect(clampToGrid(4, 5, 10, 10, 1).clamped).toBe(false);
	});

	it("gridToLonLat interpola esquinas", () => {
		const region = {
			width: 10,
			height: 10,
			corners: {
				nw: [-116, 33],
				ne: [-115, 33],
				sw: [-116, 32],
				se: [-115, 32],
			},
		} as unknown as Region;
		expect(gridToLonLat(region, 0, 0)).toEqual([-116, 33]);
		const [lon, lat] = gridToLonLat(region, 5, 5);
		expect(lon).toBeCloseTo(-115.5);
		expect(lat).toBeCloseTo(32.5);
	});
});

describe("screenToWorld (rotación de ejes −45°)", () => {
	it("adelante va hacia el noroeste de la grilla (−x, −z)", () => {
		const [dx, dz] = screenToWorld(0, 1);
		expect(dx).toBeCloseTo(-Math.SQRT1_2);
		expect(dz).toBeCloseTo(-Math.SQRT1_2);
	});
	it("derecha va hacia el noreste (+x, −z)", () => {
		const [dx, dz] = screenToWorld(1, 0);
		expect(dx).toBeCloseTo(Math.SQRT1_2);
		expect(dz).toBeCloseTo(-Math.SQRT1_2);
	});
	it("las diagonales se normalizan", () => {
		const [dx, dz] = screenToWorld(1, 1);
		expect(Math.hypot(dx, dz)).toBeCloseTo(1);
	});
});

describe("colormap", () => {
	it("es claro en 0 y cálido para hundimiento", () => {
		const limit = symmetricLimit([-12, 1]);
		expect(limit).toBe(12);
		expect(valueToT(0, limit)).toBe(0.5);
		expect(valueToT(-12, limit)).toBe(1);
		const [r, , b] = vik(valueToT(-10, limit));
		expect(r).toBeGreaterThan(b);
		expect(vik(0.5)[1]).toBeGreaterThan(0.85);
	});
	it("genera una LUT RGBA", () => {
		const lut = colormapLut(4);
		expect(lut.length).toBe(16);
		expect(lut[3]).toBe(255);
	});
});
