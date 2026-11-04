/**
 * Contrato del manifiesto de datos. Espeja `pipeline/src/nisar_pipeline/manifest.py`;
 * ambos lados validan `pipeline/tests/fixtures/manifest.sample.json`.
 */
import { z } from "zod";

export const SUPPORTED_LAYER_TYPES = ["los-displacement"] as const;
export type SupportedLayerType = (typeof SUPPORTED_LAYER_TYPES)[number];

const LonLat = z.tuple([z.number(), z.number()]);
const BBox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const Credit = z.object({
	name: z.string(),
	attribution: z.string(),
	url: z.string(),
});

const Poi = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	lon: z.number(),
	lat: z.number(),
	col: z.number(),
	row: z.number(),
});

const Terrain = z.object({
	path: z.string(),
	encoding: z.literal("int16-le"),
	units: z.literal("m"),
	heightRange: z.tuple([z.number(), z.number()]),
	credits: z.array(Credit),
});

const RawLayer = z.object({
	id: z.string(),
	type: z.string(),
	name: z.string(),
	description: z.string(),
	units: z.literal("cm"),
	path: z.string(),
	encoding: z.literal("int16-le"),
	scale: z.number().positive(),
	nodata: z.number().int(),
	dates: z.array(z.iso.date()).min(1),
	valueRange: z.tuple([z.number(), z.number()]),
	colormap: z.literal("diverging-vik"),
	source: z.enum(["nisar", "sentinel-1", "synthetic"]),
	products: z.array(z.string()),
	credits: z.array(Credit),
});

const RawRegion = z.object({
	id: z.string(),
	name: z.string(),
	bbox: BBox,
	bboxProjected: BBox,
	corners: z.object({ nw: LonLat, ne: LonLat, sw: LonLat, se: LonLat }),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	cellSizeM: z.number().positive(),
	terrain: Terrain,
	pois: z.array(Poi),
	layers: z.array(RawLayer),
});

export const RawManifestSchema = z.object({
	schemaVersion: z.literal(1),
	generatedAt: z.string(),
	projection: z.string(),
	regions: z.array(RawRegion).min(1),
});

export type Credit = z.infer<typeof Credit>;
export type Poi = z.infer<typeof Poi>;
export type Layer = z.infer<typeof RawLayer> & { type: SupportedLayerType };
export type Region = Omit<z.infer<typeof RawRegion>, "layers"> & {
	layers: Layer[];
};
export type Manifest = Omit<z.infer<typeof RawManifestSchema>, "regions"> & {
	regions: Region[];
};

function isSupported(type: string): type is SupportedLayerType {
	return (SUPPORTED_LAYER_TYPES as readonly string[]).includes(type);
}

/**
 * Valida el manifiesto y omite (con aviso) las capas de tipos que esta versión no soporta,
 * para que agregar capas nuevas en el pipeline no rompa la app.
 */
export function parseManifest(
	input: unknown,
	warn: (msg: string) => void = console.warn,
): Manifest {
	const raw = RawManifestSchema.parse(input);
	return {
		...raw,
		regions: raw.regions.map((region) => ({
			...region,
			layers: region.layers.filter((layer): layer is Layer => {
				if (isSupported(layer.type)) return true;
				warn(
					`[explorer] Capa "${region.id}/${layer.id}" de tipo "${layer.type}" no soportada; se omite.`,
				);
				return false;
			}),
		})),
	};
}
