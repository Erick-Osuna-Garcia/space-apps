import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapModel, MapModelKind } from "../lib/mapModels";

interface MapModelsProps {
	models: MapModel[];
	heightAt: (col: number, row: number) => number;
}

function usePlaced(
	models: MapModel[],
	heightAt: (col: number, row: number) => number,
) {
	const ref = useRef<THREE.InstancedMesh>(null);
	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		mesh.raycast = () => {};
		const dummy = new THREE.Object3D();
		for (let i = 0; i < models.length; i++) {
			const model = models[i];
			if (!model) continue;
			dummy.position.set(model.col, heightAt(model.col, model.row), model.row);
			dummy.rotation.set(0, model.yaw, 0);
			dummy.scale.setScalar(model.scale);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
	}, [models, heightAt]);
	return ref;
}

function Part({
	models,
	heightAt,
	geometry,
	color,
}: {
	models: MapModel[];
	heightAt: (col: number, row: number) => number;
	geometry: THREE.BufferGeometry;
	color: string;
}) {
	const ref = usePlaced(models, heightAt);
	const material = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color,
				roughness: 0.82,
				metalness: 0.04,
				flatShading: true,
			}),
		[color],
	);
	useLayoutEffect(
		() => () => {
			material.dispose();
		},
		[material],
	);
	if (models.length === 0) return null;
	return (
		<instancedMesh
			ref={ref}
			args={[geometry, material, models.length]}
			frustumCulled={false}
		/>
	);
}

/** Plantas, casas, edificios y autos. El origen de cada pieza está en el suelo. */
export function MapModels({ models, heightAt }: MapModelsProps) {
	const groups = useMemo(() => {
		const byKind: Record<MapModelKind, MapModel[]> = {
			crop: [],
			house: [],
			building: [],
			car: [],
		};
		for (const model of models) byKind[model.kind].push(model);
		return byKind;
	}, [models]);

	const stem = useMemo(() => {
		const geo = new THREE.CylinderGeometry(0.07, 0.1, 0.85, 5);
		geo.translate(0, 0.42, 0);
		return geo;
	}, []);
	const head = useMemo(() => {
		const geo = new THREE.ConeGeometry(0.38, 0.95, 6);
		geo.translate(0, 1.15, 0);
		return geo;
	}, []);
	const walls = useMemo(() => {
		const geo = new THREE.BoxGeometry(0.95, 0.55, 0.75);
		geo.translate(0, 0.28, 0);
		return geo;
	}, []);
	const roof = useMemo(() => {
		const geo = new THREE.ConeGeometry(0.72, 0.42, 4);
		geo.rotateY(Math.PI / 4);
		geo.translate(0, 0.76, 0);
		return geo;
	}, []);
	const tower = useMemo(() => {
		const geo = new THREE.BoxGeometry(0.62, 2.1, 0.62);
		geo.translate(0, 1.05, 0);
		return geo;
	}, []);
	const body = useMemo(() => {
		const geo = new THREE.BoxGeometry(1.15, 0.32, 0.52);
		geo.translate(0.1, 0.22, 0);
		return geo;
	}, []);
	const cabin = useMemo(() => {
		const geo = new THREE.BoxGeometry(0.48, 0.28, 0.42);
		geo.translate(-0.05, 0.5, 0);
		return geo;
	}, []);

	useLayoutEffect(
		() => () => {
			for (const geo of [stem, head, walls, roof, tower, body, cabin]) {
				geo.dispose();
			}
		},
		[stem, head, walls, roof, tower, body, cabin],
	);

	return (
		<group>
			<Part
				models={groups.crop}
				heightAt={heightAt}
				geometry={stem}
				color="#4d7c0f"
			/>
			<Part
				models={groups.crop}
				heightAt={heightAt}
				geometry={head}
				color="#eab308"
			/>
			<Part
				models={groups.house}
				heightAt={heightAt}
				geometry={walls}
				color="#e7e5e4"
			/>
			<Part
				models={groups.house}
				heightAt={heightAt}
				geometry={roof}
				color="#c2410c"
			/>
			<Part
				models={groups.building}
				heightAt={heightAt}
				geometry={tower}
				color="#94a3b8"
			/>
			<Part
				models={groups.car}
				heightAt={heightAt}
				geometry={body}
				color="#f8fafc"
			/>
			<Part
				models={groups.car}
				heightAt={heightAt}
				geometry={cabin}
				color="#38bdf8"
			/>
		</group>
	);
}
