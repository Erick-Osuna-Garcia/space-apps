import { queryOptions, skipToken } from "@tanstack/react-query";
import { z } from "zod";
import { EjidoSchema, type Ejido } from "../lib/ejidos";
import type { Feature } from "../lib/infrastructure";
import {
	type Layer,
	type Manifest,
	type Overlay,
	parseManifest,
	type Region,
} from "../manifest";

export const DATA_BASE = "/data";

/** Decodifica un binario Int16 LE validando el tamaño esperado. */
export function decodeInt16(
	buffer: ArrayBuffer,
	expectedLength: number,
): Int16Array {
	if (buffer.byteLength !== expectedLength * 2) {
		throw new Error(
			`Tamaño inesperado: ${buffer.byteLength} bytes, se esperaban ${expectedLength * 2}`,
		);
	}
	// Int16Array usa el endianness de la plataforma; todos los navegadores objetivo son LE.
	return new Int16Array(buffer);
}

async function fetchBinary(
	path: string,
	expectedLength: number,
): Promise<Int16Array> {
	const res = await fetch(`${DATA_BASE}/${path}`);
	if (!res.ok) throw new Error(`No se pudo cargar ${path}: HTTP ${res.status}`);
	return decodeInt16(await res.arrayBuffer(), expectedLength);
}

// Los assets son inmutables por build: no se vuelven a pedir.
const immutable = {
	staleTime: Number.POSITIVE_INFINITY,
	gcTime: Number.POSITIVE_INFINITY,
};

export const manifestQuery = queryOptions({
	queryKey: ["explorer", "manifest"],
	queryFn: async (): Promise<Manifest> => {
		const res = await fetch(`${DATA_BASE}/manifest.json`);
		if (!res.ok)
			throw new Error(`No se pudo cargar el manifiesto: HTTP ${res.status}`);
		return parseManifest(await res.json());
	},
	...immutable,
});

export const terrainQuery = (region: Region | null) =>
	queryOptions({
		queryKey: ["explorer", "terrain", region?.id, region?.terrain.path],
		queryFn: region
			? () => fetchBinary(region.terrain.path, region.width * region.height)
			: skipToken,
		...immutable,
	});

export const layerCubeQuery = (region: Region | null, layer: Layer | null) =>
	queryOptions({
		queryKey: ["explorer", "cube", region?.id, layer?.id, layer?.path],
		queryFn:
			region && layer
				? () =>
						fetchBinary(
							layer.path,
							layer.dates.length * region.width * region.height,
						)
				: skipToken,
		...immutable,
	});

async function fetchRaster(
	region: Region,
	layer: Layer,
): Promise<Int16Array | Uint8Array> {
	const length = Math.max(layer.dates.length, 1) * region.width * region.height;
	if (layer.encoding === "int16-le") return fetchBinary(layer.path, length);
	const res = await fetch(`${DATA_BASE}/${layer.path}`);
	if (!res.ok) {
		throw new Error(`No se pudo cargar ${layer.path}: HTTP ${res.status}`);
	}
	const bytes = new Uint8Array(await res.arrayBuffer());
	if (bytes.length !== length) {
		throw new Error(`Tamaño inesperado en ${layer.path}`);
	}
	return bytes;
}

/** Capa raster bajo demanda; una capa estática tiene una sola banda. */
export const rasterQuery = (region: Region | null, layer: Layer | null) =>
	queryOptions({
		queryKey: ["explorer", "raster", region?.id, layer?.id, layer?.path],
		queryFn: region && layer ? () => fetchRaster(region, layer) : skipToken,
		...immutable,
	});

async function fetchOverlay(overlay: Overlay): Promise<Feature[]> {
	const res = await fetch(`${DATA_BASE}/${overlay.path}`);
	if (!res.ok) {
		throw new Error(`No se pudo cargar ${overlay.path}: HTTP ${res.status}`);
	}
	return res.json();
}

async function fetchEjidos(overlay: Overlay): Promise<Ejido[]> {
	const res = await fetch(`${DATA_BASE}/${overlay.path}`);
	if (!res.ok) {
		throw new Error(`No se pudo cargar ${overlay.path}: HTTP ${res.status}`);
	}
	return z.array(EjidoSchema).parse(await res.json());
}

/** Tramos de una superposición vectorial. */
export const overlayQuery = (overlay: Overlay | null) =>
	queryOptions({
		queryKey: ["explorer", "overlay", overlay?.path],
		queryFn: overlay ? () => fetchOverlay(overlay) : skipToken,
		...immutable,
	});

export const ejidosQuery = (overlay: Overlay | null) =>
	queryOptions({
		queryKey: ["explorer", "ejidos", overlay?.path],
		queryFn: overlay ? () => fetchEjidos(overlay) : skipToken,
		...immutable,
	});

const ImpactEventSchema = z.object({
	id: z.string(),
	type: z.string(),
	date: z.string(),
	dateEnd: z.string().nullable(),
	place: z.string(),
	col: z.number(),
	row: z.number(),
	areaKm2: z.number(),
	title: z.string(),
	detail: z.string(),
	source: z.string(),
});

export type ImpactEvent = z.infer<typeof ImpactEventSchema>;

async function fetchEvents(path: string): Promise<ImpactEvent[]> {
	const res = await fetch(`${DATA_BASE}/${path}`);
	if (!res.ok) throw new Error(`No se pudo cargar ${path}: HTTP ${res.status}`);
	return z.array(ImpactEventSchema).parse(await res.json());
}

/** Eventos de impacto detectados por el pipeline. */
export const eventsQuery = (region: Region | null) =>
	queryOptions({
		queryKey: ["explorer", "events", region?.id, region?.events],
		queryFn: region?.events
			? () => fetchEvents(region.events as string)
			: skipToken,
		...immutable,
	});
