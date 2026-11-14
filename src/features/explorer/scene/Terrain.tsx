import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { type Palette, symmetricLimit } from "../lib/colormap";
import {
	addRipple,
	createRipples,
	isWaterAt,
	MAX_RIPPLES,
	shipRipple,
} from "../lib/water";
import type { Layer, Region } from "../manifest";
import { useFlight } from "./flight";
import {
	bandColors,
	bandsTexture,
	createTerrainMaterial,
	cubeTexture,
	deformCubeTexture,
	fieldTexture,
	type LayerUniforms,
	PaintMode,
	type PaintModeValue,
	paletteLut,
	waterTexture,
} from "./layerMaterial";
import { buildTerrain } from "./terrainGeometry";

const TRANSITION_S = 2;
/** Velocidad de la nave, en celdas por segundo, desde la que deja ondas. */
const RIPPLE_MIN_SPEED = 0.5;

export interface WaterData {
	/** Máscara de `waterMask`. */
	mask: Uint8Array;
	dates: number;
	/** Fecha de agua que corresponde a la fecha actual. */
	index: number;
}

interface TerrainProps {
	region: Region;
	heights: Int16Array;
	exaggeration: number;
	step: number;
	layer: Layer | null;
	cube: Int16Array | null;
	visible: boolean;
	opacity: number;
	dateIndex: number;
	reducedMotion: boolean;
	/** Qué pinta la capa; si faltan sus datos se cae al acumulado. */
	paintMode: PaintModeValue;
	field: Float32Array | null;
	fieldLimit: number;
	fieldMin: number;
	palette: Palette;
	bands: Uint8Array | null;
	/** Colores por valor de banda y si llevan contorno. */
	bandPalette: string[];
	contour: boolean;
	/** Unidades de escena por cm de desplazamiento; 0 = sin hundimiento 3D. */
	deformScale: number;
	/** Cubo de geometría (cm) con huecos rellenados; null = sin hundimiento 3D. */
	deformCube: Float32Array | null;
	/** Compartidos con lo que debe seguir al terreno, como las cintas de los caminos. */
	uniforms: LayerUniforms;
	water: WaterData | null;
	/** Oleaje y ondas encendidos. */
	waterMotion: boolean;
	/** Máscara de cultivo: 1 zona, 2 elegida. null = no pintar. */
	agriMask: Uint8Array | null;
	/** 255 dentro de la ciudad. null = no pintar. */
	cityMask: Uint8Array | null;
	/** El sombreado de la ciudad parpadea solo mientras está elegida. */
	cityLive: boolean;
}

export function Terrain({
	region,
	heights,
	exaggeration,
	step,
	layer,
	cube,
	visible,
	opacity,
	dateIndex,
	reducedMotion,
	paintMode,
	field,
	fieldLimit,
	fieldMin,
	palette,
	bands,
	bandPalette,
	contour,
	deformScale,
	deformCube,
	uniforms,
	water,
	waterMotion,
	agriMask,
	cityMask,
	cityLive,
}: TerrainProps) {
	const flight = useFlight();
	const geo = useMemo(
		() => buildTerrain(region, heights, exaggeration, step),
		[region, heights, exaggeration, step],
	);
	useEffect(
		() => () => {
			geo.surface.dispose();
			geo.skirt.dispose();
		},
		[geo],
	);

	const ripples = useMemo(createRipples, []);
	const material = useMemo(() => createTerrainMaterial(uniforms), [uniforms]);
	const skirtMaterial = useMemo(
		() => new THREE.MeshStandardMaterial({ color: "#3b2f2a", roughness: 1 }),
		[],
	);
	useEffect(
		() => () => {
			material.dispose();
			skirtMaterial.dispose();
			uniforms.uLut.value.dispose();
			uniforms.uCube.value.dispose();
			uniforms.uLutSeq.value.dispose();
			uniforms.uField.value.dispose();
			uniforms.uBands.value.dispose();
			uniforms.uDeformCube.value.dispose();
			uniforms.uWater.value.dispose();
			uniforms.uAgri.value.dispose();
			uniforms.uCity.value.dispose();
		},
		[material, skirtMaterial, uniforms],
	);

	// Textura del cubo de la capa activa.
	useEffect(() => {
		if (!layer || !cube) {
			uniforms.uLayerOn.value = 0;
			return;
		}
		const tex = cubeTexture(
			cube,
			region.width,
			region.height,
			layer.dates.length,
			layer.scale,
			layer.nodata,
		);
		uniforms.uCube.value.dispose();
		uniforms.uCube.value = tex;
		uniforms.uLimit.value = symmetricLimit(layer.valueRange);
	}, [layer, cube, region, uniforms]);

	useEffect(() => {
		uniforms.uTexel.value.set(1 / region.width, 1 / region.height);
	}, [region, uniforms]);

	// Máscara de agua: el mapa funciona igual mientras no llega.
	const waterMask = water?.mask ?? null;
	const waterDates = water?.dates ?? 0;
	const waterIndex = water?.index ?? 0;
	useEffect(() => {
		if (!waterMask) {
			uniforms.uWaterOn.value = 0;
			return;
		}
		uniforms.uWater.value.dispose();
		uniforms.uWater.value = waterTexture(
			waterMask,
			region.width,
			region.height,
			waterDates,
		);
		uniforms.uWaterOn.value = 1;
	}, [waterMask, waterDates, region, uniforms]);

	// Geometría del hundimiento 3D.
	useEffect(() => {
		if (!deformCube || !layer) return;
		uniforms.uDeformCube.value.dispose();
		uniforms.uDeformCube.value = deformCubeTexture(
			deformCube,
			region.width,
			region.height,
			layer.dates.length,
		);
	}, [deformCube, layer, region, uniforms]);

	// Campo de la vista activa (velocidad, diferencial o aceleración).
	useEffect(() => {
		if (!field) return;
		uniforms.uField.value.dispose();
		uniforms.uField.value = fieldTexture(field, region.width, region.height);
		uniforms.uFieldLimit.value = fieldLimit;
		uniforms.uFieldMin.value = fieldMin;
	}, [field, fieldLimit, fieldMin, region, uniforms]);

	useEffect(() => {
		uniforms.uLutSeq.value.dispose();
		uniforms.uLutSeq.value = paletteLut(palette);
	}, [palette, uniforms]);

	useEffect(() => {
		uniforms.uBandColors.value = bandColors(bandPalette);
		uniforms.uContour.value = contour ? 1 : 0;
	}, [bandPalette, contour, uniforms]);

	useEffect(() => {
		if (!agriMask) {
			uniforms.uAgriOn.value = 0;
			return;
		}
		const next = bandsTexture(agriMask, region.width, region.height);
		next.generateMipmaps = false;
		uniforms.uAgri.value.dispose();
		uniforms.uAgri.value = next;
		uniforms.uAgriOn.value = 1;
	}, [agriMask, region, uniforms]);

	useEffect(() => {
		if (!cityMask) {
			uniforms.uCityOn.value = 0;
			return;
		}
		const next = bandsTexture(cityMask, region.width, region.height);
		next.generateMipmaps = false;
		uniforms.uCity.value.dispose();
		uniforms.uCity.value = next;
		uniforms.uCityOn.value = 1;
	}, [cityMask, region, uniforms]);

	// Bandas de la vista Zonas.
	useEffect(() => {
		if (!bands) return;
		uniforms.uBands.value.dispose();
		uniforms.uBands.value = bandsTexture(bands, region.width, region.height);
	}, [bands, region, uniforms]);

	// Transición suave entre fechas: A = lo que se ve ahora, B = la fecha nueva.
	useEffect(() => {
		const u = uniforms;
		const current =
			u.uDateA.value + (u.uDateB.value - u.uDateA.value) * u.uMix.value;
		u.uDateA.value = Math.round(current);
		u.uDateB.value = dateIndex;
		u.uMix.value = reducedMotion ? 1 : 0;
	}, [dateIndex, reducedMotion, uniforms]);

	useEffect(() => {
		const u = uniforms;
		const current =
			u.uWaterA.value + (u.uWaterB.value - u.uWaterA.value) * u.uWaterMix.value;
		u.uWaterA.value = Math.round(current);
		u.uWaterB.value = waterIndex;
		u.uWaterMix.value = reducedMotion ? 1 : 0;
	}, [waterIndex, reducedMotion, uniforms]);

	useFrame((_, dt) => {
		const ready = paintMode === PaintMode.BANDS ? bands : field;
		const hasCube = Boolean(layer && cube);
		const on = Boolean(
			visible && (paintMode === PaintMode.CUBE ? hasCube : ready || hasCube),
		);
		uniforms.uLayerOn.value = on ? 1 : 0
		uniforms.uOpacity.value = opacity;
		uniforms.uMode.value = ready ? paintMode : PaintMode.CUBE;
		uniforms.uDeform.value = visible && hasCube && deformCube ? deformScale : 0;
		uniforms.uCityPulse.value =
			!cityLive || reducedMotion
				? 0.35
				: 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
		if (uniforms.uMix.value < 1) {
			uniforms.uMix.value = Math.min(
				1,
				uniforms.uMix.value + dt / TRANSITION_S,
			);
		}
		if (uniforms.uWaterMix.value < 1) {
			uniforms.uWaterMix.value = Math.min(
				1,
				uniforms.uWaterMix.value + dt / TRANSITION_S,
			);
		}

		const tap = flight.tap;
		flight.tap = null;
		if (!waterMotion || reducedMotion) return;
		const time = uniforms.uTime.value + dt;
		uniforms.uTime.value = time;
		if (!waterMask) return;
		const over = (col: number, row: number) =>
			isWaterAt(waterMask, region.width, region.height, waterIndex, col, row);
		if (tap && over(tap.col, tap.row))
			addRipple(ripples, tap.col, tap.row, time);
		shipRipple(
			ripples,
			flight.col,
			flight.row,
			time,
			Math.hypot(flight.vx, flight.vz) >= RIPPLE_MIN_SPEED,
			over(flight.col, flight.row),
		);
		for (let i = 0; i < MAX_RIPPLES; i++) {
			uniforms.uRipples.value[i].fromArray(ripples.items, i * 3);
		}
	});

	return (
		<group>
			<mesh
				geometry={geo.surface}
				material={material}
				receiveShadow
				// el hundimiento 3D desplaza vértices en el shader: el bounding sphere no lo sabe
				frustumCulled={false}
			/>
			<mesh geometry={geo.skirt} material={skirtMaterial} />
		</group>
	);
}
