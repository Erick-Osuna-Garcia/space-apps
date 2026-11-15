import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
	CROP_VARIANTS,
	type CropId,
	isCropKind,
	type MapModel,
} from "../lib/mapModels";
import { useFlight } from "./flight";

interface MapModelsProps {
	models: MapModel[];
	heightAt: (col: number, row: number) => number;
	/** Cultivo elegido en el diagrama: crece y los demás cultivos se achican. */
	focus: CropId | null;
}

const MAX_DRAWN = 480;
const dummy = new THREE.Object3D();

function usePlaced(
	models: MapModel[],
	heightAt: (col: number, row: number) => number,
	gain: number,
) {
	const ref = useRef<THREE.InstancedMesh>(null);
	const flight = useFlight();
	const last = useRef({
		col: 1e9,
		row: 1e9,
		radius: 0,
		gain: 0,
		models,
		heightAt,
	});
	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		mesh.raycast = () => {};
		mesh.count = 0;
	}, []);
	useFrame(({ camera, size }) => {
		const mesh = ref.current;
		if (!mesh || models.length === 0) return;
		const zoom = (camera as THREE.OrthographicCamera).zoom;
		const radius = Math.max(
			18,
			(Math.max(size.width, size.height) / zoom) * 0.55,
		);
		const col = flight.col;
		const row = flight.row;
		const prev = last.current;
		if (
			prev.models === models &&
			prev.gain === gain &&
			prev.heightAt === heightAt &&
			prev.radius === radius &&
			Math.abs(prev.col - col) < 1.5 &&
			Math.abs(prev.row - row) < 1.5
		) {
			return;
		}
		last.current = { col, row, radius, gain, models, heightAt };
		const stride = radius > 90 ? 4 : radius > 50 ? 2 : 1;
		let n = 0;
		for (let i = 0; i < models.length && n < MAX_DRAWN; i += stride) {
			const model = models[i];
			if (!model) continue;
			if (
				Math.abs(model.col - col) > radius ||
				Math.abs(model.row - row) > radius
			) {
				continue;
			}
			dummy.position.set(model.col, heightAt(model.col, model.row), model.row);
			dummy.rotation.set(0, model.yaw, 0);
			dummy.scale.setScalar(model.scale * gain);
			dummy.updateMatrix();
			mesh.setMatrixAt(n, dummy.matrix);
			n += 1;
		}
		mesh.count = n;
		mesh.instanceMatrix.needsUpdate = true;
	});
	return ref;
}

function Part({
	models,
	heightAt,
	geometry,
	color,
	gain = 1,
}: {
	models: MapModel[];
	heightAt: (col: number, row: number) => number;
	geometry: THREE.BufferGeometry;
	color: string;
	gain?: number;
}) {
	const ref = usePlaced(models, heightAt, gain);
	const material = useMemo(
		() =>
			new THREE.MeshLambertMaterial({
				color,
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
			castShadow={false}
			receiveShadow={false}
		/>
	);
}

type Solid =
	| {
			form: "cylinder";
			rt: number;
			rb: number;
			h: number;
			y: number;
			color: string;
	  }
	| { form: "cone"; r: number; h: number; y: number; color: string }
	| {
			form: "sphere";
			r: number;
			y: number;
			sy: number;
			color: string;
	  }
	| {
			form: "box";
			w: number;
			h: number;
			d: number;
			y: number;
			color: string;
	  };

const CROP_SHAPES: Record<CropId, Solid[]> = {
	trigo: [
		{ form: "cylinder", rt: 0.05, rb: 0.08, h: 0.9, y: 0.45, color: "#a16207" },
		{ form: "cone", r: 0.22, h: 0.5, y: 1.05, color: "#eab308" },
	],
	algodon: [
		{ form: "cylinder", rt: 0.07, rb: 0.1, h: 0.4, y: 0.2, color: "#3f6212" },
		{ form: "sphere", r: 0.24, y: 0.58, sy: 1, color: "#f8fafc" },
	],
	alfalfa: [{ form: "sphere", r: 0.42, y: 0.2, sy: 0.45, color: "#4d7c0f" }],
	cebollin: [
		{
			form: "cylinder",
			rt: 0.04,
			rb: 0.07,
			h: 1.05,
			y: 0.52,
			color: "#22c55e",
		},
	],
	esparrago: [
		{
			form: "cylinder",
			rt: 0.04,
			rb: 0.06,
			h: 1.25,
			y: 0.62,
			color: "#65a30d",
		},
		{ form: "cone", r: 0.08, h: 0.22, y: 1.32, color: "#84cc16" },
	],
	sorgo: [
		{
			form: "cylinder",
			rt: 0.05,
			rb: 0.08,
			h: 1.05,
			y: 0.52,
			color: "#854d0e",
		},
		{ form: "cone", r: 0.18, h: 0.42, y: 1.15, color: "#ca8a04" },
	],
	cebolla: [
		{ form: "sphere", r: 0.22, y: 0.16, sy: 0.85, color: "#f5e6c8" },
		{ form: "cone", r: 0.1, h: 0.45, y: 0.48, color: "#4d7c0f" },
	],
	col: [{ form: "sphere", r: 0.2, y: 0.2, sy: 0.85, color: "#3f6212" }],
	cilantro: [
		{
			form: "cylinder",
			rt: 0.03,
			rb: 0.05,
			h: 0.55,
			y: 0.28,
			color: "#166534",
		},
		{ form: "cone", r: 0.2, h: 0.35, y: 0.68, color: "#4ade80" },
	],
	espinaca: [
		{ form: "box", w: 0.55, h: 0.14, d: 0.38, y: 0.1, color: "#14532d" },
	],
	brocoli: [
		{ form: "cylinder", rt: 0.08, rb: 0.1, h: 0.32, y: 0.16, color: "#365314" },
		{ form: "sphere", r: 0.28, y: 0.5, sy: 0.8, color: "#14532d" },
	],
	lechuga: [{ form: "sphere", r: 0.4, y: 0.16, sy: 0.4, color: "#86efac" }],
	pepino: [
		{ form: "box", w: 0.72, h: 0.16, d: 0.22, y: 0.12, color: "#16a34a" },
	],
	tomatillo: [
		{
			form: "cylinder",
			rt: 0.04,
			rb: 0.05,
			h: 0.28,
			y: 0.14,
			color: "#3f6212",
		},
		{ form: "sphere", r: 0.16, y: 0.4, sy: 1, color: "#a3e635" },
	],
	nogal: [
		{ form: "cylinder", rt: 0.08, rb: 0.12, h: 0.7, y: 0.35, color: "#78350f" },
		{ form: "sphere", r: 0.5, y: 1.0, sy: 0.75, color: "#3f6212" },
	],
	olivo: [
		{ form: "cylinder", rt: 0.07, rb: 0.1, h: 0.5, y: 0.25, color: "#57534e" },
		{ form: "sphere", r: 0.36, y: 0.78, sy: 0.7, color: "#a8a29e" },
	],
	vid: [
		{
			form: "cylinder",
			rt: 0.05,
			rb: 0.07,
			h: 0.28,
			y: 0.14,
			color: "#44403c",
		},
		{ form: "sphere", r: 0.26, y: 0.48, sy: 0.7, color: "#6b21a8" },
	],
	durazno: [
		{ form: "cylinder", rt: 0.07, rb: 0.1, h: 0.55, y: 0.28, color: "#78350f" },
		{ form: "sphere", r: 0.4, y: 0.85, sy: 0.8, color: "#f9a8d4" },
	],
	higuera: [
		{ form: "cylinder", rt: 0.08, rb: 0.11, h: 0.4, y: 0.2, color: "#57534e" },
		{ form: "sphere", r: 0.48, y: 0.62, sy: 0.5, color: "#4d7c0f" },
	],
	datil: [
		{ form: "cylinder", rt: 0.07, rb: 0.1, h: 1.45, y: 0.72, color: "#92400e" },
		{ form: "cone", r: 0.32, h: 0.5, y: 1.6, color: "#ea580c" },
	],
};

function solidGeometry(part: Solid) {
	let geo: THREE.BufferGeometry;
	if (part.form === "cylinder") {
		geo = new THREE.CylinderGeometry(part.rt, part.rb, part.h, 6);
		geo.translate(0, part.y, 0);
	} else if (part.form === "cone") {
		geo = new THREE.ConeGeometry(part.r, part.h, 6);
		geo.translate(0, part.y, 0);
	} else if (part.form === "sphere") {
		geo = new THREE.SphereGeometry(part.r, 8, 6);
		geo.scale(1, part.sy, 1);
		geo.translate(0, part.y, 0);
	} else {
		geo = new THREE.BoxGeometry(part.w, part.h, part.d);
		geo.translate(0, part.y, 0);
	}
	return geo;
}

/** Plantas, casas, edificios y autos. El origen de cada pieza está en el suelo. */
export function MapModels({ models, heightAt, focus }: MapModelsProps) {
	const groups = useMemo(() => {
		const byKind = new Map<MapModel["kind"], MapModel[]>();
		for (const model of models) {
			const list = byKind.get(model.kind);
			if (list) list.push(model);
			else byKind.set(model.kind, [model]);
		}
		return byKind;
	}, [models]);

	const cropParts = useMemo(
		() =>
			CROP_VARIANTS.flatMap((variant) =>
				CROP_SHAPES[variant.id].map((part, index) => ({
					key: `${variant.id}-${index}`,
					kind: variant.id,
					geometry: solidGeometry(part),
					color: part.color,
				})),
			),
		[],
	);
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
			for (const geo of [walls, roof, tower, body, cabin]) geo.dispose();
			for (const part of cropParts) part.geometry.dispose();
		},
		[walls, roof, tower, body, cabin, cropParts],
	);

	return (
		<group>
			{cropParts.map((part) => (
				<Part
					key={part.key}
					models={groups.get(part.kind) ?? []}
					heightAt={heightAt}
					geometry={part.geometry}
					color={part.color}
					gain={
						focus == null
							? 1
							: part.kind === focus
								? 1.7
								: isCropKind(focus)
									? 0.35
									: 1
					}
				/>
			))}
			<Part
				models={groups.get("house") ?? []}
				heightAt={heightAt}
				geometry={walls}
				color="#e7e5e4"
			/>
			<Part
				models={groups.get("house") ?? []}
				heightAt={heightAt}
				geometry={roof}
				color="#c2410c"
			/>
			<Part
				models={groups.get("building") ?? []}
				heightAt={heightAt}
				geometry={tower}
				color="#94a3b8"
			/>
			<Part
				models={groups.get("car") ?? []}
				heightAt={heightAt}
				geometry={body}
				color="#f8fafc"
			/>
			<Part
				models={groups.get("car") ?? []}
				heightAt={heightAt}
				geometry={cabin}
				color="#38bdf8"
			/>
		</group>
	);
}
