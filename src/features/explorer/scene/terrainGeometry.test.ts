import { expect, it } from "vitest";
import type { Region } from "../manifest";
import {
	baseHeightFn,
	DESKTOP_TERRAIN_SPAN,
	MOBILE_TERRAIN_SPAN,
	terrainStep,
	verticalScale,
} from "./terrainGeometry";

it("la altura base es el relieve escalado, sin hundimiento", () => {
	const region = { width: 2, height: 2, cellSizeM: 100 } as Region;
	const at = baseHeightFn(region, Int16Array.from([0, 100, 0, 100]), 3);
	expect(at(1.5, 0.5)).toBeCloseTo(100 * verticalScale(region, 3));
	expect(at(1, 0.5)).toBeCloseTo(50 * verticalScale(region, 3));
});

it("decima la malla al presupuesto de vértices, no a una celda por vértice", () => {
	expect(terrainStep(960, 754, false)).toBe(
		Math.ceil(960 / DESKTOP_TERRAIN_SPAN),
	);
	expect(terrainStep(960, 754, true)).toBe(
		Math.ceil(960 / MOBILE_TERRAIN_SPAN),
	);
	expect(terrainStep(200, 200, false)).toBe(1);
});
