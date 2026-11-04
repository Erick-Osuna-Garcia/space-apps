import { describe, expect, it } from "vitest";
import { pickTerrain } from "./pick";

const dir = {
	x: -1 / Math.sqrt(3),
	y: -1 / Math.sqrt(3),
	z: -1 / Math.sqrt(3),
};

describe("pickTerrain", () => {
	it("encuentra el punto sobre terreno plano", () => {
		const hit = pickTerrain(
			{ x: 150, y: 100, z: 150 },
			dir,
			() => 0,
			200,
			200,
			500,
		);
		expect(hit?.col).toBeCloseTo(50, 1);
		expect(hit?.row).toBeCloseTo(50, 1);
	});

	it("choca antes con un relieve alto", () => {
		const hill = (c: number) => (c < 80 ? 40 : 0);
		const hit = pickTerrain(
			{ x: 150, y: 100, z: 150 },
			dir,
			hill,
			200,
			200,
			500,
		);
		expect(hit?.col).toBeCloseTo(80, 0);
	});

	it("null si el rayo sale de la grilla", () => {
		expect(
			pickTerrain({ x: 10, y: 100, z: 10 }, dir, () => 0, 200, 200, 500),
		).toBeNull();
	});
});
