import { expect, it } from "vitest";
import type { Region } from "../manifest";
import { baseHeightFn, verticalScale } from "./terrainGeometry";

it("la altura base es el relieve escalado, sin hundimiento", () => {
	const region = { width: 2, height: 2, cellSizeM: 100 } as Region;
	const at = baseHeightFn(region, Int16Array.from([0, 100, 0, 100]), 3);
	expect(at(1.5, 0.5)).toBeCloseTo(100 * verticalScale(region, 3));
	expect(at(1, 0.5)).toBeCloseTo(50 * verticalScale(region, 3));
});
