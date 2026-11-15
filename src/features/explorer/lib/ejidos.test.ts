import { describe, expect, it } from "vitest";
import { EjidoSchema, ejidoKey } from "./ejidos";

describe("ejidos", () => {
	it("valida un perímetro con nombre y centro", () => {
		const ejido = EjidoSchema.parse({
			name: "Zacatecas",
			rings: [
				[
					[1, 1],
					[4, 1],
					[4, 4],
					[1, 4],
					[1, 1],
				],
			],
			col: 2.5,
			row: 2.5,
		});
		expect(ejidoKey(ejido, 3)).toBe("Zacatecas-3");
	});
});
