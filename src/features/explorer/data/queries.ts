import { queryOptions, skipToken } from "@tanstack/react-query";
import {
	type Layer,
	type Manifest,
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
