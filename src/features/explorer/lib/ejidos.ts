import { z } from "zod";

export const EjidoSchema = z.object({
	name: z.string(),
	class: z.literal("ejido").optional(),
	rings: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
	col: z.number(),
	row: z.number(),
});

export type Ejido = z.infer<typeof EjidoSchema>;

export const ejidoKey = (ejido: Ejido, index: number) =>
	`${ejido.name}-${index}`;
