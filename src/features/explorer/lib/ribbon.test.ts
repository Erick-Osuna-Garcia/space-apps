import { describe, expect, it } from "vitest";
import { affectedSegments, type Feature, toSegments } from "./infrastructure";
import {
	buildRibbon,
	ROAD_STYLES,
	ribbonHits,
	roadClass,
	roadFade,
} from "./ribbon";

const flat = () => 0;
const road = (points: Array<[number, number]>, cls = "primary"): Feature => ({
	name: "",
	class: cls,
	points,
});

describe("cintas", () => {
	it("subdivide el tramo para seguir el relieve", () => {
		const r = buildRibbon(
			[
				road([
					[0, 0],
					[4, 0],
				]),
			],
			(col) => col * 2,
		);
		expect(r.position.length / 6).toBe(5);
		expect(Array.from(r.position.filter((_, i) => i % 6 === 1))).toEqual([
			0, 2, 4, 6, 8,
		]);
		expect(r.index.length).toBe(4 * 6);
	});

	it("una polilínea de 2 puntos da una cinta con lados opuestos", () => {
		const r = buildRibbon(
			[
				road([
					[0, 0],
					[1, 0],
				]),
			],
			flat,
		);
		expect(r.position.length / 3).toBe(4);
		expect(Array.from(r.side.slice(0, 4))).toEqual([-0, 1, 0, -1]);
	});

	it("la unión de una curva queda en inglete, sin hueco", () => {
		const r = buildRibbon(
			[
				road([
					[0, 0],
					[1, 0],
					[1, 1],
				]),
			],
			flat,
		);
		const [x, z] = [r.side[4], r.side[5]]; // punto de la esquina
		expect(Math.hypot(x, z)).toBeCloseTo(Math.SQRT2, 5);
		expect(Math.abs(x)).toBeCloseTo(1, 5);
	});

	it("limita el inglete en una vuelta cerrada y aguanta un regreso", () => {
		const sharp = buildRibbon(
			[
				road([
					[0, 0],
					[10, 0],
					[0, 0.1],
				]),
			],
			flat,
			100,
		);
		expect(Math.hypot(sharp.side[4], sharp.side[5])).toBeLessThanOrEqual(2.001);
		const back = buildRibbon(
			[
				road([
					[0, 0],
					[1, 0],
					[0, 0],
				]),
			],
			flat,
			100,
		);
		expect(Array.from(back.side).every(Number.isFinite)).toBe(true);
	});

	it("ignora puntos repetidos y vías sin largo", () => {
		const r = buildRibbon(
			[
				road([
					[0, 0],
					[0, 0],
					[1, 0],
				]),
				road([
					[5, 5],
					[5, 5],
				]),
			],
			flat,
		);
		expect(r.position.length / 6).toBe(2);
		expect(Array.from(r.side).every(Number.isFinite)).toBe(true);
	});

	it("los tramos resaltados coinciden tras subdividir", () => {
		const features = [
			road([
				[0, 0],
				[0, 0],
				[3, 0],
			]),
			road([
				[1, 2],
				[3, 2],
				[3, 4],
			]),
		];
		const segments = toSegments(features, 100);
		const bands = new Uint8Array(100);
		bands[3 * 10 + 3] = 255; // solo el último tramo pasa por aquí
		const { flags } = affectedSegments(segments, 10, 10, bands, null, 1);
		expect(Array.from(flags)).toEqual([0, 0, 0, 1]);
		const r = buildRibbon(features, flat);
		const hits = ribbonHits(r.segment, flags);
		for (let v = 0; v < hits.length; v++) {
			expect(hits[v]).toBe(r.segment[v] === 3 ? 1 : 0);
		}
		expect(hits.some((h) => h === 1)).toBe(true);
	});
});

describe("detalle según el zoom", () => {
	const all = ROAD_STYLES.map((s) => roadClass(s.id));
	const visible = (cells: number) =>
		ROAD_STYLES.filter((_, i) => roadFade(all[i], cells, false) > 0).map(
			(s) => s.id,
		);

	it("de lejos solo quedan las vías grandes", () => {
		expect(visible(770)).toEqual(["motorway", "trunk"]);
	});

	it("en la vista inicial se ven todas", () => {
		expect(visible(57)).toHaveLength(ROAD_STYLES.length);
	});

	it("un tramo afectado se ve a cualquier zoom", () => {
		expect(roadFade(roadClass("secondary"), 770, true)).toBe(1);
	});

	it("una clase desconocida se trata como secundaria", () => {
		expect(ROAD_STYLES[roadClass("service")].id).toBe("secondary");
	});
});
