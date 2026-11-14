import { describe, expect, it } from "vitest";
import type { Feature } from "./infrastructure";
import { placeMapModels } from "./mapModels";

const grid = (width: number, height: number, paint: (i: number) => number) =>
	Uint8Array.from({ length: width * height }, (_, i) => paint(i));

describe("modelos del mapa", () => {
	it("pone una planta en cultivo y no en otra clase", () => {
		const land = grid(4, 2, (i) => (i === 0 ? 5 : 3));
		const models = placeMapModels({
			landcover: land,
			width: 4,
			height: 2,
			roads: [],
			crops: true,
			settlements: true,
			cars: false,
			cropStride: 1,
			urbanStride: 1,
		});
		expect(models.filter((m) => m.kind === "crop")).toHaveLength(1);
		expect(models[0]?.col).toBeGreaterThan(0);
		expect(
			models.some((m) => m.kind === "house" || m.kind === "building"),
		).toBe(false);
	});

	it("separa casas y edificios en la zona urbana", () => {
		const land = grid(3, 3, () => 6);
		const models = placeMapModels({
			landcover: land,
			width: 3,
			height: 3,
			roads: [],
			crops: false,
			settlements: true,
			cars: false,
			urbanStride: 1,
		});
		const kinds = new Set(models.map((m) => m.kind));
		expect(models).toHaveLength(9);
		expect(kinds.has("house") || kinds.has("building")).toBe(true);
		expect(kinds.has("crop")).toBe(false);
	});

	it("apoya autos sobre una vía, mirando a lo largo del tramo", () => {
		const road: Feature = {
			name: "",
			class: "primary",
			points: [
				[0, 0],
				[40, 0],
			],
		};
		const models = placeMapModels({
			landcover: null,
			width: 50,
			height: 10,
			roads: [road],
			crops: true,
			settlements: true,
			cars: true,
			carStep: 22,
		});
		expect(models.map((m) => m.kind)).toEqual(["car", "car"]);
		expect(models[0]?.col).toBeCloseTo(11);
		expect(models[1]?.col).toBeCloseTo(33);
		expect(models[0]?.yaw).toBeCloseTo(0);
	});

	it("ignora un canal al poner autos", () => {
		const canal: Feature = {
			name: "",
			class: "canal",
			points: [
				[0, 0],
				[40, 0],
			],
		};
		expect(
			placeMapModels({
				landcover: null,
				width: 50,
				height: 10,
				roads: [canal],
				crops: false,
				settlements: false,
				cars: true,
				carStep: 10,
			}),
		).toEqual([]);
	});
});
