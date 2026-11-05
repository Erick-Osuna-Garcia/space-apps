import { describe, expect, it } from "vitest";
import type { Layer, Region } from "../manifest";
import {
	buildCatalog,
	categoricalPlane,
	classColors,
	continuousPlane,
	eventView,
	nearestDateIndex,
	readLayer,
	resolveView,
	sourceAt,
} from "./catalog";

const disp = {
	id: "subsidence",
	type: "los-displacement",
	theme: "movement",
	dates: ["2025-01-01", "2025-02-01"],
} as unknown as Layer;
const raster = {
	id: "hh",
	type: "raster",
	theme: "surface",
	name: "Construcciones",
	dates: ["2025-01-01", "2025-02-01"],
	scale: 0.5,
	nodata: -32768,
	units: "dB",
	paint: "sequential",
	classes: [],
} as unknown as Layer;
const land = {
	id: "land",
	type: "raster",
	theme: "impact",
	dates: [],
	scale: 1,
	nodata: 0,
	paint: "categorical",
	units: "clase",
	classes: [{ value: 2, name: "Cultivos", color: "#123456" }],
} as unknown as Layer;
const region = {
	width: 2,
	height: 1,
	layers: [disp, raster, land],
} as unknown as Region;

describe("buildCatalog", () => {
	it("agrupa vistas y capas, y deshabilita aceleración con pocas fechas", () => {
		const c = buildCatalog(region, 4);
		expect(c.map((i) => i.view)).toEqual([
			"cumulative",
			"velocity",
			"zones",
			"differential",
			"acceleration",
			"layer:hh",
			"layer:land",
		]);
		expect(c[4].disabled).toBe(true);
		expect(c[5].theme).toBe("surface");
	});
	it("sin desplazamiento no ofrece vistas de movimiento", () => {
		const c = buildCatalog({ ...region, layers: [raster] }, 4);
		expect(c.map((i) => i.view)).toEqual(["layer:hh"]);
	});
});

describe("resolveView", () => {
	const c = buildCatalog({ ...region, layers: [raster] }, 4);
	it("usa la primera disponible si la pedida no existe", () => {
		expect(resolveView(c, "cumulative")?.view).toBe("layer:hh");
	});
	it("null sin capas", () => {
		expect(resolveView([], "cumulative")).toBeNull();
	});
});

describe("nearestDateIndex", () => {
	const dates = ["2025-01-01", "2025-03-01", "2025-06-01"];
	it("elige la más cercana", () => {
		expect(nearestDateIndex(dates, "2025-02-20")).toBe(1);
		expect(nearestDateIndex(dates, "2026-01-01")).toBe(2);
	});
	it("sin fecha va a la última y sin fechas da -1", () => {
		expect(nearestDateIndex(dates, null)).toBe(2);
		expect(nearestDateIndex([], "2025-01-01")).toBe(-1);
	});
});

describe("planos", () => {
	it("continuo aplica escala y nodata; categórico recorta la banda", () => {
		const d = Int16Array.from([1, 2, 4, -32768]);
		const p = continuousPlane(d, { scale: 0.5, nodata: -32768 }, 2, 1);
		expect(p[0]).toBe(2);
		expect(p[1]).toBeNaN();
		expect([...categoricalPlane(Uint8Array.from([1, 2, 3, 4]), 2, 1)]).toEqual([
			3, 4,
		]);
		expect(
			continuousPlane(
				Int16Array.from([2, 4]),
				{ scale: 1, nodata: 0 },
				2,
				-1,
			)[1],
		).toBe(4);
	});
	it("colores por clase", () => {
		expect(classColors(land, "#000")[2]).toBe("#123456");
		expect(classColors(land, "#000")[3]).toBe("#000");
	});
});

describe("readLayer", () => {
	it("lee continuas con unidades y la fecha más cercana", () => {
		const d = Int16Array.from([10, 20, 30, -32768]);
		expect(readLayer(raster, d, region, 0.5, 0.5, "2025-02-01")).toBe(
			"15.0 dB",
		);
		expect(readLayer(raster, d, region, 1.5, 0.5, "2025-02-01")).toBe(
			"Sin dato",
		);
	});
	it("lee categóricas y capas estáticas", () => {
		const d = Uint8Array.from([2, 0]);
		expect(readLayer(land, d, region, 0.5, 0.5, null)).toBe("Cultivos");
		expect(readLayer(land, d, region, 1.5, 0.5, null)).toBe("Sin dato");
	});
});

describe("sourceAt", () => {
	const layer = {
		source: "nisar",
		segments: [
			{ until: "2025-10-01", source: "sentinel-1" },
			{ until: "2026-10-18", source: "nisar" },
		],
	} as const as Pick<Layer, "source" | "segments">;
	it("elige la fuente por tramo", () => {
		expect(sourceAt(layer, "2020-01-01")).toBe("sentinel-1");
		expect(sourceAt(layer, "2025-10-01")).toBe("sentinel-1");
		expect(sourceAt(layer, "2026-01-01")).toBe("nisar");
	});
	it("sin tramos usa la fuente de la capa", () => {
		expect(sourceAt({ source: "nisar", segments: [] }, "2020-01-01")).toBe(
			"nisar",
		);
	});
});

describe("eventView", () => {
	it("lleva cada evento a su capa", () => {
		expect(eventView("water")).toBe("layer:water");
		expect(eventView("subsidence")).toBe("zones");
		expect(eventView("rate-change")).toBe("zones");
	});
});
