import { describe, expect, it } from "vitest";
import type { Feature } from "./infrastructure";
import {
	isCropKind,
	nearestAnyModel,
	parkedModel,
	placeMapModels,
	urbanCityMask,
} from "./mapModels";

const grid = (width: number, height: number, paint: (i: number) => number) =>
	Uint8Array.from({ length: width * height }, (_, i) => paint(i));

describe("modelos del mapa", () => {
	it("pone plantas con cobertura de suelo, sin un flag de panel", () => {
		const land = grid(4, 2, (i) => (i === 0 ? 5 : 3));
		const models = placeMapModels({
			landcover: land,
			width: 4,
			height: 2,
			roads: [],
			crops: Boolean(land),
			settlements: false,
			cars: false,
			cropStride: 1,
		});
		expect(models.filter((m) => isCropKind(m.kind))).toHaveLength(1);
	});

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
		expect(models.filter((m) => isCropKind(m.kind))).toHaveLength(1);
		expect(models[0]?.col).toBeGreaterThan(0);
		expect(
			models.some((m) => m.kind === "house" || m.kind === "building"),
		).toBe(false);
	});

	it("agrupa hasta cinco casas cuando el bloque urbano es grande", () => {
		const land = grid(3, 3, () => 6);
		const models = placeMapModels({
			landcover: land,
			width: 3,
			height: 3,
			roads: [],
			crops: false,
			settlements: true,
			cars: false,
			urbanStride: 3,
		});
		expect(models).toHaveLength(5);
		expect(
			models.every((m) => m.kind === "house" || m.kind === "building"),
		).toBe(true);
		const cols = models.map((m) => m.col);
		expect(Math.max(...cols) - Math.min(...cols)).toBeLessThan(1.6);
	});

	it("deja una sola planta si el cultivo está aislado y cinco si el bloque está lleno", () => {
		const lone = grid(5, 5, (i) => (i === 0 ? 5 : 3));
		const one = placeMapModels({
			landcover: lone,
			width: 5,
			height: 5,
			roads: [],
			crops: true,
			settlements: false,
			cars: false,
			cropStride: 5,
		});
		expect(one.filter((m) => isCropKind(m.kind))).toHaveLength(1);

		const full = grid(5, 5, () => 5);
		const many = placeMapModels({
			landcover: full,
			width: 5,
			height: 5,
			roads: [],
			crops: true,
			settlements: false,
			cars: false,
			cropStride: 5,
		});
		const crops = many.filter((m) => isCropKind(m.kind));
		expect(crops).toHaveLength(5);
		expect(new Set(crops.map((m) => m.kind)).size).toBe(1);
		const cols = crops.map((m) => m.col);
		expect(Math.max(...cols) - Math.min(...cols)).toBeLessThan(1.2);
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

	it("agrupa la ciudad urbana conectada al punto y deja fuera el resto", () => {
		const land = grid(5, 3, (i) => (i < 4 ? 6 : 3));
		const mask = urbanCityMask(land, 5, 3, 0.2, 0.2);
		expect(mask).not.toBeNull();
		expect(mask?.[0]).toBe(255);
		expect(mask?.[1]).toBe(255);
		expect(mask?.[4]).toBe(0);
		expect(urbanCityMask(grid(3, 3, () => 5), 3, 3, 1, 1)).toBeNull();
	});

	it("elige la casa más cercana, no un cultivo más lejos", () => {
		const crop = {
			kind: "trigo" as const,
			col: 10,
			row: 0,
			yaw: 0,
			scale: 1,
		};
		const house = {
			kind: "house" as const,
			col: 1,
			row: 0,
			yaw: 0,
			scale: 1,
		};
		const hit = nearestAnyModel([crop, house], { col: 0, row: 0 });
		expect(hit?.kind).toBe("house");
	});

	it("no elige modelo en vuelo ni fuera del radio", () => {
		const house = {
			kind: "house" as const,
			col: 1,
			row: 0,
			yaw: 0,
			scale: 1,
		};
		expect(
			parkedModel([house], { col: 0, row: 0, vx: 2, vz: 0 }),
		).toBeNull();
		expect(parkedModel([house], { col: 0, row: 0, vx: 0, vz: 0 })?.kind).toBe(
			"house",
		);
		expect(
			nearestAnyModel([house], { col: 40, row: 40 }),
		).toBeNull();
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
