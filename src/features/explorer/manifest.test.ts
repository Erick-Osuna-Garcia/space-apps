import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseManifest } from "./manifest";

const fixture = JSON.parse(
	readFileSync(
		resolve(__dirname, "../../../pipeline/tests/fixtures/manifest.sample.json"),
		"utf8",
	),
);

describe("parseManifest", () => {
	it("valida el fixture compartido con el pipeline", () => {
		const m = parseManifest(fixture, () => {});
		expect(m.regions.map((r) => r.id)).toEqual(["mexicali", "tijuana"]);
		expect(m.regions[0].pois[0].id).toBe("cerro-prieto");
	});

	it("omite capas de tipo desconocido con un aviso", () => {
		const warn = vi.fn();
		const m = parseManifest(fixture, warn);
		expect(m.regions[0].layers.map((l) => l.id)).toEqual(["subsidence"]);
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("backscatter-change");
	});

	it("rechaza un source desconocido", () => {
		const bad = structuredClone(fixture);
		bad.regions[0].layers[0].source = "landsat";
		expect(() => parseManifest(bad, () => {})).toThrow();
	});

	it("valida el manifiesto generado en public/data si existe", () => {
		const path = resolve(__dirname, "../../../public/data/manifest.json");
		let raw: unknown;
		try {
			raw = JSON.parse(readFileSync(path, "utf8"));
		} catch {
			return;
		}
		expect(() => parseManifest(raw, () => {})).not.toThrow();
	});
});
