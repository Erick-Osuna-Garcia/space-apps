import { describe, expect, it } from "vitest";
import { Band } from "./impact";
import {
	affectedSegments,
	arrowGrid,
	arrowStep,
	type Feature,
	nearestSegment,
	toSegments,
} from "./infrastructure";

const features: Feature[] = [
	{
		name: "Canal A",
		class: "canal",
		points: [
			[0, 0],
			[10, 0],
			[10, 10],
		],
	},
];

describe("segmentos", () => {
	const segs = toSegments(features, 100);
	it("parte en tramos con largo en km", () => {
		expect(segs).toHaveLength(2);
		expect(segs[0].km).toBeCloseTo(1);
	});

	it("marca tramos en zona y por diferencial, y suma km", () => {
		const W = 12;
		const bands = new Uint8Array(W * 12).fill(Band.NONE);
		bands[0 * W + 5] = Band.HIGH;
		const r = affectedSegments(segs, W, 12, bands, null, 1);
		expect([...r.flags]).toEqual([1, 0]);
		expect(r.km).toBeCloseTo(1);
		const diff = new Float32Array(W * 12);
		diff[5 * W + 10] = 2;
		expect([...affectedSegments(segs, W, 12, null, diff, 1).flags]).toEqual([
			0, 1,
		]);
	});

	it("encuentra el tramo cercano y nada si está lejos", () => {
		expect(nearestSegment(segs, 5, 1)?.feature).toBe(0);
		expect(nearestSegment(segs, 40, 40)).toBeNull();
	});
});

describe("flechas", () => {
	it("usa la mediana del bloque y omite valores pequeños y vacíos", () => {
		const f = new Float32Array(8 * 8).fill(3);
		for (let k = 0; k < 32; k++) f[k] = 0.1;
		const a = arrowGrid(f, 8, 8, 4);
		expect(a.map((x) => x.value)).toEqual([3, 3]);
		expect(a[0].row).toBe(6);
		expect(arrowGrid(new Float32Array(64).fill(Number.NaN), 8, 8, 4)).toEqual(
			[],
		);
	});
	it("más densas con más zoom", () => {
		expect(arrowStep(8)).toBeLessThan(arrowStep(1));
	});
});
