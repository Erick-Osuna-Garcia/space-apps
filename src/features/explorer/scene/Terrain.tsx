import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { symmetricLimit } from "../lib/colormap";
import type { Layer, Region } from "../manifest";
import {
	createLayerUniforms,
	createTerrainMaterial,
	cubeTexture,
	deformCubeTexture,
	velocityTexture,
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
	/** Campo de velocidad (cm/año) y su límite de color; null = aún no calculado. */
	velocity: Float32Array | null;
	velocityLimit: number;
	colorMode: "cumulative" | "velocity";
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
	velocity,
	velocityLimit,
	colorMode,
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
			uniforms.uVelocity.value.dispose();
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

	// Campo de velocidad (modo velocidad).
	useEffect(() => {
		if (!velocity) return;
		uniforms.uVelocity.value.dispose();
		uniforms.uVelocity.value = velocityTexture(
			velocity,
			region.width,
			region.height,
		);
		uniforms.uVelLimit.value = velocityLimit;
	}, [velocity, velocityLimit, region, uniforms]);

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
		uniforms.uMode.value = colorMode === "velocity" && velocity ? 1 : 0;
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
