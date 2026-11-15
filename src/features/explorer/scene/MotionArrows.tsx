import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { arrowGrid, arrowStep } from "../lib/infrastructure";

const LIFT = 2;
const MAX_ARROWS = 1500;
const dummy = new THREE.Object3D();

interface MotionArrowsProps {
	field: Float32Array;
	width: number;
	height: number;
	limit: number;
	heightAt: (col: number, row: number) => number;
}

/** Flechas este-oeste sobre el terreno; el largo indica la magnitud y la densidad sigue al zoom. */
export function MotionArrows({
	field,
	width,
	height,
	limit,
	heightAt,
}: MotionArrowsProps) {
	const { camera } = useThree();
	const mesh = useRef<THREE.InstancedMesh>(null);
	const stepRef = useRef(0);
	const geometry = useMemo(() => {
		const g = new THREE.ConeGeometry(0.9, 4, 5);
		g.rotateZ(-Math.PI / 2); // apunta a +x (este)
		return g;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: hay que recomponer las flechas si cambia el campo o el relieve
	useEffect(() => {
		stepRef.current = 0;
	}, [field, width, height, limit, heightAt]);

	useFrame(() => {
		const m = mesh.current;
		if (!m) return;
		const next = arrowStep((camera as THREE.OrthographicCamera).zoom);
		if (next === stepRef.current) return;
		stepRef.current = next;
		const arrows = arrowGrid(field, width, height, next);
		const n = Math.min(arrows.length, MAX_ARROWS);
		for (let i = 0; i < n; i++) {
			const a = arrows[i];
			if (!a) continue;
			const size = 0.5 + Math.min(Math.abs(a.value) / limit, 1) * 1.5;
			dummy.position.set(a.col, heightAt(a.col, a.row) + LIFT, a.row);
			dummy.rotation.set(0, a.value >= 0 ? 0 : Math.PI, 0);
			dummy.scale.setScalar((size * next) / 24);
			dummy.updateMatrix();
			m.setMatrixAt(i, dummy.matrix);
		}
		m.count = n;
		m.instanceMatrix.needsUpdate = true;
	});

	return (
		<instancedMesh
			ref={mesh}
			args={[geometry, undefined, MAX_ARROWS]}
			frustumCulled={false}
		>
			<meshBasicMaterial color="#fde047" />
		</instancedMesh>
	);
}
