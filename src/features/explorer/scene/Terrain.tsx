import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { symmetricLimit } from "../lib/colormap";
import type { Layer, Region } from "../manifest";
import {
	bandsTexture,
	createLayerUniforms,
	createTerrainMaterial,
	cubeTexture,
	deformCubeTexture,
	fieldTexture,
	PaintMode,
	type PaintModeValue,
} from "./layerMaterial";
import { buildTerrain } from "./terrainGeometry";

const TRANSITION_S = 0.6;

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
	bands: Uint8Array | null;
	/** Unidades de escena por cm de desplazamiento; 0 = sin hundimiento 3D. */
	deformScale: number;
	/** Cubo de geometría (cm) con huecos rellenados; null = sin hundimiento 3D. */
	deformCube: Float32Array | null;
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
	bands,
	deformScale,
	deformCube,
}: TerrainProps) {
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

	const uniforms = useMemo(createLayerUniforms, []);
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
		uniforms.uTexel.value.set(1 / region.width, 1 / region.height);
	}, [layer, cube, region, uniforms]);

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
	}, [field, fieldLimit, region, uniforms]);

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

	useFrame((_, dt) => {
		const on = Boolean(visible && layer && cube);
		uniforms.uLayerOn.value = on ? 1 : 0;
		uniforms.uOpacity.value = opacity;
		const ready = paintMode === PaintMode.BANDS ? bands : field;
		uniforms.uMode.value = ready ? paintMode : PaintMode.CUBE;
		uniforms.uDeform.value = on && deformCube ? deformScale : 0;
		if (uniforms.uMix.value < 1) {
			uniforms.uMix.value = Math.min(
				1,
				uniforms.uMix.value + dt / TRANSITION_S,
			);
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
