import { describe, expect, it } from "vitest";
import {
	addRipple,
	createRipples,
	isWaterAt,
	MAX_RIPPLES,
	RIPPLE_EVERY_S,
	shipRipple,
	waterDateIndex,
	waterMask,
} from "./water";

const W = 9;
const H = 9;
const plane = (fill: (c: number, r: number) => number) =>
	Uint8Array.from({ length: W * H }, (_, i) => fill(i % W, Math.floor(i / W)));

describe("máscara de agua", () => {
	it("una celda aislada queda bajo el umbral", () => {
		const m = waterMask(
			plane((c, r) => (c === 4 && r === 4 ? 3 : 1)),
			W,
			H,
			1,
		);
		expect(isWaterAt(m, W, H, 0, 4, 4)).toBe(false);
	});

	it("un bloque de agua sí se dibuja y separa permanente de nueva", () => {
		const block = (v: number) =>
			plane((c, r) => (c >= 2 && c <= 6 && r >= 2 && r <= 6 ? v : 1));
		const perm = waterMask(block(2), W, H, 1);
		const fresh = waterMask(block(3), W, H, 1);
		const center = (4 * W + 4) * 2;
		expect(perm[center]).toBe(255);
		expect(perm[center + 1]).toBe(0);
		expect(fresh[center]).toBe(0);
		expect(fresh[center + 1]).toBe(255);
		expect(isWaterAt(perm, W, H, 0, 4, 4)).toBe(true);
		expect(isWaterAt(perm, W, H, 0, 0, 0)).toBe(false);
	});

	it("un río de una celda de ancho se conserva", () => {
		const m = waterMask(
			plane((_, r) => (r === 4 ? 2 : 1)),
			W,
			H,
			1,
		);
		expect(isWaterAt(m, W, H, 0, 4, 4)).toBe(true);
	});

	it("sin dato no cuenta como agua", () => {
		expect(
			isWaterAt(
				waterMask(
					plane(() => 0),
					W,
					H,
					1,
				),
				W,
				H,
				0,
				4,
				4,
			),
		).toBe(false);
	});

	it("cada fecha tiene su plano y fuera de la grilla no hay agua", () => {
		const cube = new Uint8Array(W * H * 2).fill(1);
		cube.fill(3, W * H);
		const m = waterMask(cube, W, H, 2);
		expect(isWaterAt(m, W, H, 0, 4, 4)).toBe(false);
		expect(isWaterAt(m, W, H, 1, 4, 4)).toBe(true);
		expect(isWaterAt(m, W, H, 1, -1, 4)).toBe(false);
	});
});

describe("fechas de agua", () => {
	const dates = ["2025-10-23", "2025-11-16", "2025-12-10"];

	it("usa la medición de esa fecha", () => {
		expect(waterDateIndex(dates, "2025-11-16")).toBe(1);
	});

	it("entre mediciones usa la anterior", () => {
		expect(waterDateIndex(dates, "2025-12-09")).toBe(1);
		expect(waterDateIndex(dates, "2026-06-01")).toBe(2);
	});

	it("antes de la primera medición usa la primera", () => {
		expect(waterDateIndex(dates, "2020-01-01")).toBe(0);
		expect(waterDateIndex(dates, null)).toBe(0);
	});
});

describe("ondas", () => {
	it("nacen solo en movimiento sobre agua y con pausa entre ellas", () => {
		const r = createRipples();
		expect(shipRipple(r, 1, 1, 10, false, true)).toBe(false);
		expect(shipRipple(r, 1, 1, 10, true, false)).toBe(false);
		expect(shipRipple(r, 1, 1, 10, true, true)).toBe(true);
		expect(shipRipple(r, 1, 1, 10 + RIPPLE_EVERY_S / 2, true, true)).toBe(
			false,
		);
		expect(shipRipple(r, 1, 1, 10 + RIPPLE_EVERY_S + 0.01, true, true)).toBe(
			true,
		);
	});

	it("al llenarse reemplaza la más vieja", () => {
		const r = createRipples();
		for (let i = 0; i <= MAX_RIPPLES; i++) addRipple(r, i, 0, i);
		expect(r.items[0]).toBe(MAX_RIPPLES);
		expect(r.items[3]).toBe(1);
	});
});
