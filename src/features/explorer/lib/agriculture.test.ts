import { describe, expect, it } from "vitest";
import {
	AGRI_COPY,
	alignSeries,
	barrierMask,
	buildZones,
	changeWord,
	disturbanceWord,
	listedZones,
	listHelp,
	moistureSeries,
	nearestWaterway,
	noWayText,
	cropMask,
	outlineMask,
	paintWayFlags,
	vegetationWord,
	waterBeside,
	waterLines,
	withComparison,
	zoneAt,
} from "./agriculture";
import { type Feature, toSegments } from "./infrastructure";

const fill = (n: number, value: number) =>
	Uint8Array.from({ length: n }, () => value);

describe("zonas agrícolas", () => {
	it("deja fuera un parche chico y parte un bloque enorme", () => {
		const small = fill(4, 5);
		const tiny = buildZones(small, 2, 2, 100, new Uint8Array(4));
		expect(tiny.zones).toHaveLength(0);

		const wide = fill(40, 5);
		const split = buildZones(wide, 40, 1, 1000, new Uint8Array(40));
		expect(split.zones.map((z) => z.areaKm2)).toEqual([16, 16, 8]);
		expect(split.zones.map((z) => z.id)).toEqual([0, 1, 2]);
		expect(split.zones[0].minCell).toBeLessThan(split.zones[1].minCell);
	});

	it("una barrera parte el cultivo en dos bloques", () => {
		const land = fill(6, 5);
		const barriers = barrierMask(3, 2, [
			{
				name: "",
				class: "canal",
				points: [
					[1.5, -1],
					[1.5, 3],
				],
			},
		]);
		expect(barriers[0 * 3 + 1]).toBe(1);
		expect(barriers[1 * 3 + 1]).toBe(1);
		const map = buildZones(land, 3, 2, 1000, barriers);
		expect(map.zones).toHaveLength(2);
		expect(map.zones.every((z) => z.areaKm2 === 2)).toBe(true);
	});

	it("el orden de ids no cambia entre llamadas", () => {
		const land = fill(8, 5);
		land[3] = 0;
		const once = buildZones(land, 4, 2, 1000, new Uint8Array(8));
		const twice = buildZones(land, 4, 2, 1000, new Uint8Array(8));
		expect(once.zones.map((z) => [z.id, z.minCell, z.areaKm2])).toEqual(
			twice.zones.map((z) => [z.id, z.minCell, z.areaKm2]),
		);
	});

	it("la lista avisa el cupo y el toque llega a una zona que no está en ella", () => {
		const land = fill(40, 5);
		const map = buildZones(land, 40, 1, 1000, new Uint8Array(40));
		const list = listedZones(map.zones, 2);
		expect(list.listed).toHaveLength(2);
		expect(list.omitted).toBe(true);
		expect(listHelp(true)).toContain("Hay más zonas");
		const hidden = map.zones[2];
		const col = hidden.minCell % 40;
		expect(zoneAt(map, land, 40, col + 0.2, 0.2)?.id).toBe(hidden.id);
		expect(zoneAt(map, land, 40, 0.2, 0.2)?.id).not.toBe(hidden.id);
	});

	it("un cultivo bajo el mínimo o una celda que no es cultivo no selecciona zona", () => {
		const land = fill(4, 5);
		land[3] = 6;
		const map = buildZones(land, 2, 2, 100, new Uint8Array(4));
		expect(zoneAt(map, land, 2, 0.2, 0.2)).toBeNull();
		expect(zoneAt(map, land, 2, 1.2, 1.2)).toBeNull();
	});

	it("el centroide es el centro de las celdas y el borde no marca el interior", () => {
		const land = fill(9, 5);
		const map = buildZones(land, 3, 3, 1000, new Uint8Array(9));
		expect(map.zones).toHaveLength(1);
		expect(map.zones[0].col).toBeCloseTo(1.5);
		expect(map.zones[0].row).toBeCloseTo(1.5);
		expect(map.zones[0].areaKm2).toBe(9);
		const mask = outlineMask(map.zones[0].cells, 3, 3);
		expect(mask[1 * 3 + 1]).toBe(0);
		expect(mask[0]).toBe(1);
		expect(mask[1]).toBe(1);
		expect([...mask].filter((v) => v === 1)).toHaveLength(8);
	});

	it("marca en el mapa las zonas válidas y distingue la elegida", () => {
		const land = fill(9, 5);
		land[4] = 0;
		const map = buildZones(land, 3, 3, 1000, new Uint8Array(9));
		const painted = cropMask(map.owner, map.zones[0]?.id ?? null);
		expect(painted[4]).toBe(0);
		expect(painted[0]).toBe(2);
		expect([...painted].filter((v) => v === 2)).toHaveLength(8);
		expect(cropMask(map.owner, null)[0]).toBe(1);
	});
});

describe("lectura de la zona", () => {
	const cells = [0, 1];

	it("la humedad usa la escala y el nodata no cuenta como cero", () => {
		const cube = new Int16Array([1000, -32768, 0, 500]);
		// 1000 × 0.001 = 1; si el nodata entrara como cero, la media sería 0.5.
		expect(moistureSeries(cells, cube, 2, 2, 0.001, -32768)).toEqual([1, 0.25]);
		const empty = new Int16Array([-32768, -32768]);
		expect(moistureSeries(cells, empty, 1, 2, 0.001, -32768)).toEqual([null]);
	});

	it("resume vegetación, cambios y disturbios, y omite una capa ausente", () => {
		const hv = new Int16Array([0, 0, 400, 400]);
		expect(vegetationWord(cells, hv, 1, 2, 0.01, -32768)).toBe("más intensa");
		const weaker = new Int16Array([0, 0, -400, -400]);
		expect(vegetationWord(cells, weaker, 1, 2, 0.01, -32768)).toBe("más débil");
		const same = new Int16Array([0, 0, 100, 100]);
		expect(vegetationWord(cells, same, 1, 2, 0.01, -32768)).toBe("parecida");
		expect(vegetationWord(cells, null, 1, 2, 0.01, -32768)).toBeNull();

		const change = new Uint8Array([1, 1, 1, 1]);
		expect(changeWord(cells, change, 1, 2)).toBe("sin cambio dominante");
		const up = new Uint8Array([1, 1, 2, 2]);
		expect(changeWord(cells, up, 1, 2)).toBe("señal más fuerte");
		const down = new Uint8Array([1, 1, 3, 3]);
		expect(changeWord(cells, down, 1, 2)).toBe("señal más débil");
		expect(changeWord(cells, null, 1, 2)).toBeNull();

		const calm = new Uint8Array([1, 1, 1, 1]);
		expect(disturbanceWord(cells, calm, 1, 2)).toBe("sin disturbio marcado");
		const hit = new Uint8Array([1, 1, 2, 2]);
		expect(disturbanceWord(cells, hit, 1, 2)).toBe("la superficie se disturbó");
		expect(disturbanceWord(cells, null, 1, 2)).toBeNull();
	});

	it("rechaza la cuarta zona y alinea las fechas", () => {
		const first = withComparison(0, [], 1);
		const second = withComparison(0, first.extras, 2);
		const third = withComparison(0, second.extras, 3);
		expect(second.rejected).toBe(false);
		expect(second.extras).toEqual([1, 2]);
		expect(third.rejected).toBe(true);
		expect(third.extras).toEqual([1, 2]);
		const aligned = alignSeries([
			{ dates: ["2026-02-01", "2026-01-01"], values: [0.2, 0.1] },
			{ dates: ["2026-01-01"], values: [0.3] },
		]);
		expect(aligned.dates).toEqual(["2026-01-01", "2026-02-01"]);
		expect(aligned.columns).toEqual([
			[0.1, 0.2],
			[0.3, null],
		]);
	});

	it("los textos dicen los límites y no recomiendan regar ni nombran una causa", () => {
		const text = [
			AGRI_COPY.coverage,
			AGRI_COPY.noAdvice,
			AGRI_COPY.moisture,
			AGRI_COPY.noCause,
			listHelp(false),
		].join(" ");
		expect(text).toContain("2021");
		expect(text).toContain("No identifica el cultivo");
		expect(text).toContain("no estima la cosecha ni aconseja riego");
		expect(text).toContain("primeros centímetros");
		expect(text).toContain("200 m");
		expect(text).toContain("1 km²");
		expect(text).toContain("25 km²");
		expect(text).not.toMatch(/recomienda regar/i);
		expect(text).not.toMatch(/la causa es|debido a|porque/i);
	});
});

describe("agua de la zona", () => {
	const canal: Feature = {
		name: "Canal Alimentador",
		class: "canal",
		points: [
			[0, 0],
			[4, 0],
		],
	};
	const river: Feature = {
		name: "",
		class: "river",
		points: [
			[0, 2],
			[4, 2],
		],
	};
	const far: Feature = {
		name: "Lejos",
		class: "canal",
		points: [
			[0, 40],
			[4, 40],
		],
	};

	it("elige canal con nombre, río sin nombre, y descarta lo que está a más de 2 km", () => {
		const cells = [1];
		const near = nearestWaterway(cells, 5, 100, [
			{
				id: "canals",
				kind: "canal",
				features: [canal],
				segments: toSegments([canal], 100),
			},
			{
				id: "rivers",
				kind: "river",
				features: [river],
				segments: toSegments([river], 100),
			},
		]);
		expect(near?.kind).toBe("canal");
		expect(near?.name).toBe("Canal Alimentador");
		expect(near?.distanceM).toBeLessThan(2000);

		const onlyRiver = nearestWaterway(cells, 5, 100, [
			{
				id: "rivers",
				kind: "river",
				features: [river],
				segments: toSegments([river], 100),
			},
		]);
		expect(onlyRiver?.kind).toBe("river");
		expect(onlyRiver?.name).toBeNull();

		const none = nearestWaterway(cells, 5, 100, [
			{
				id: "canals",
				kind: "canal",
				features: [far],
				segments: toSegments([far], 100),
			},
		]);
		expect(none).toBeNull();
		expect(noWayText(false)).not.toContain("río");
	});

	it("marca agua nueva junto a la zona, permanente dentro, y ninguna", () => {
		const width = 3;
		const plane = new Uint8Array(9);
		plane[1] = 3;
		expect(waterBeside([4], plane, width, 3)).toEqual({
			permanent: false,
			fresh: true,
		});
		plane[4] = 2;
		expect(waterBeside([4], plane, width, 3).permanent).toBe(true);
		expect(waterBeside([4], new Uint8Array(9), width, 3)).toEqual({
			permanent: false,
			fresh: false,
		});
	});

	it("la ficha aclara que la cercanía no es riego y no habla de derechos", () => {
		const hit = {
			overlayId: "canals",
			kind: "canal" as const,
			name: "Norte",
			distanceM: 400,
			feature: 0,
		};
		const withWater = waterLines(
			hit,
			{ permanent: true, fresh: true },
			true,
		).join(" ");
		expect(withWater).toContain(AGRI_COPY.proximity);
		expect(withWater).toContain("Agua nueva");
		expect(withWater).toContain("Agua permanente");
		const none = waterLines(
			null,
			{ permanent: false, fresh: false },
			false,
		).join(" ");
		expect(none).toContain("No hay un canal");
		expect(none).not.toMatch(/derecho/i);
		expect(none).not.toContain(AGRI_COPY.proximity);
	});

	it("resalta solo los tramos de la vía elegida", () => {
		const features = [canal, far];
		const segments = toSegments(features, 100);
		const flags = paintWayFlags(
			new Uint8Array(segments.length).fill(1),
			segments,
			0,
		);
		expect(flags[0]).toBe(2);
		expect(flags[flags.length - 1]).toBe(1);
	});
});
