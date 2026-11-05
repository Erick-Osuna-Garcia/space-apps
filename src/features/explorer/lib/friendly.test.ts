import { describe, expect, it } from "vitest";
import type { Poi } from "../manifest";
import {
	areaComparison,
	elapsedText,
	nearestPoi,
	sizeComparison,
	trendLevel,
} from "./friendly";

describe("trendLevel", () => {
	it.each([
		[null, "none"],
		[Number.NaN, "none"],
		[0, "stable"],
		[-0.99, "stable"],
		[0.99, "stable"],
		[-1, "slow"],
		[-2.9, "slow"],
		[-3, "moderate"],
		[-7.9, "moderate"],
		[-8, "fast"],
		[-12, "fast"],
		[1, "toward"],
	])("%s -> %s", (rate, level) => {
		expect(trendLevel(rate)).toBe(level);
	});
});

describe("sizeComparison", () => {
	it("usa el valor absoluto y elige el objeto", () => {
		expect(sizeComparison(-13)).toBe("como un lápiz");
		expect(sizeComparison(2)).toBe("como una moneda");
		expect(sizeComparison(8)).toBe("como una tarjeta bancaria");
		expect(sizeComparison(30)).toBe("como una regla escolar");
		expect(sizeComparison(90)).toBe("más que una regla escolar");
	});
	it("omite valores despreciables o nulos", () => {
		expect(sizeComparison(0.05)).toBeNull();
		expect(sizeComparison(null)).toBeNull();
	});
});

describe("areaComparison", () => {
	it("redondea a dos cifras significativas", () => {
		expect(areaComparison(120)).toBe("≈ 17,000 canchas de fútbol");
	});
	it("maneja áreas pequeñas y nulas", () => {
		expect(areaComparison(0)).toBeNull();
		expect(areaComparison(0.001)).toBe("≈ menos de una cancha de fútbol");
		expect(areaComparison(0.00714)).toBe("≈ 1 cancha de fútbol");
	});
});

describe("nearestPoi", () => {
	const pois = [
		{ id: "a", name: "Cerro", col: 10, row: 10 },
		{ id: "b", name: "Ciudad", col: 100, row: 100 },
	] as Poi[];

	it("elige el más cercano y da la distancia", () => {
		const r = nearestPoi(pois, 40, 50, 100); // 50 celdas de 100 m
		expect(r?.poi.id).toBe("a");
		expect(r?.text).toBe("A 5.0 km de Cerro");
	});
	it("a menos de 1 km dice que está sobre el punto", () => {
		expect(nearestPoi(pois, 12, 10, 100)?.text).toBe("Sobre Cerro");
	});
	it("null sin puntos de interés", () => {
		expect(nearestPoi([], 0, 0, 100)).toBeNull();
	});
});

describe("elapsedText", () => {
	it.each([
		["2025-10-01", "Fecha inicial"],
		["2025-10-02", "1 día desde el inicio"],
		["2025-10-25", "24 días desde el inicio"],
		["2026-04-01", "6 meses desde el inicio"],
		["2026-10-01", "1 año desde el inicio"],
		["2026-11-30", "1 año y 2 meses desde el inicio"],
	])("%s", (date, text) => {
		expect(elapsedText("2025-10-01", date)).toBe(text);
	});
});
