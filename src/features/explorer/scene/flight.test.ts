import { describe, expect, it } from "vitest";
import { createFlight, EDGE_MARGIN, stepFlight } from "./flight";

const still = { dx: 0, dz: 0, boost: false };

function flight() {
	const f = createFlight();
	f.width = 100;
	f.height = 100;
	f.col = 50;
	f.row = 50;
	return f;
}

describe("stepFlight", () => {
	it("acelera con entrada y se detiene en el borde", () => {
		const f = flight();
		for (let i = 0; i < 600; i++)
			stepFlight(f, { dx: 1, dz: 0, boost: false }, 1 / 60);
		expect(f.col).toBe(100 - EDGE_MARGIN);
		expect(f.vx).toBe(0);
	});

	it("frena por fricción sin entrada", () => {
		const f = flight();
		f.vx = 30;
		for (let i = 0; i < 300; i++) stepFlight(f, still, 1 / 60);
		expect(Math.abs(f.vx)).toBeLessThan(0.1);
	});

	it("vuela hacia el objetivo y lo suelta al llegar", () => {
		const f = flight();
		f.target = { col: 70, row: 30 };
		for (let i = 0; i < 600 && f.target; i++) stepFlight(f, still, 1 / 60);
		expect(f.target).toBeNull();
		expect(f.col).toBeCloseTo(70, 0);
		expect(f.row).toBeCloseTo(30, 0);
	});

	it("el teclado cancela el vuelo a objetivo", () => {
		const f = flight();
		f.target = { col: 90, row: 90 };
		stepFlight(f, { dx: 0, dz: -1, boost: false }, 1 / 60);
		expect(f.target).toBeNull();
	});
});
