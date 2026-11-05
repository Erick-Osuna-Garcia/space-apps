/**
 * Contrato del manifiesto de datos. Espeja `pipeline/src/nisar_pipeline/manifest.py`;
 * ambos lados validan `pipeline/tests/fixtures/manifest.sample.json`.
 */
import { z } from "zod";

export const SUPPORTED_LAYER_TYPES = ["los-displacement", "raster"] as const;
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

const LayerClass = z.object({
	value: z.number().int(),
	name: z.string(),
	color: z.string(),
});

const RawLayer = z.object({
	id: z.string(),
	type: z.string(),
	theme: z.enum(["movement", "surface", "water", "impact"]),
	name: z.string(),
	description: z.string(),
	units: z.string(),
	path: z.string(),
	encoding: z.enum(["int16-le", "uint8"]),
	scale: z.number().positive(),
	nodata: z.number().int(),
	/** Vacío = capa estática de una sola banda. */
	dates: z.array(z.iso.date()),
	referenceDate: z.string().nullable(),
	valueRange: z.tuple([z.number(), z.number()]),
	paint: z.enum(["diverging", "sequential", "categorical"]),
	palette: z.enum(["vik", "heat", "gray", "greens", "blues"]),
	classes: z.array(LayerClass),
	source: z.enum([
		"nisar",
		"sentinel-1",
		"synthetic",
		"derived",
		"esa-worldcover",
		"worldpop",
	]),
	products: z.array(z.string()),
	credits: z.array(Credit),
});

const Overlay = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(["road", "canal"]),
	path: z.string(),
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
	overlays: z.array(Overlay),
});

export const RawManifestSchema = z.object({
	schemaVersion: z.literal(2),
	generatedAt: z.string(),
	projection: z.string(),
	regions: z.array(RawRegion).min(1),
});

export type Credit = z.infer<typeof Credit>;
export type Poi = z.infer<typeof Poi>;
export type Overlay = z.infer<typeof Overlay>;
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
