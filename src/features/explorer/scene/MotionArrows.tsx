import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { arrowGrid, arrowStep } from "../lib/infrastructure";

const LIFT = 5;
const MAX_ARROWS = 1500;

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
	const [step, setStep] = useState(24);
	const arrows = useMemo(
		() => arrowGrid(field, width, height, step).slice(0, MAX_ARROWS),
		[field, width, height, step],
	);
	const geometry = useMemo(() => {
		const g = new THREE.ConeGeometry(0.9, 4, 5);
		g.rotateZ(-Math.PI / 2); // apunta a +x (este)
		return g;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);

	useFrame(() => {
		const next = arrowStep((camera as THREE.OrthographicCamera).zoom);
		if (next !== step) setStep(next);
	});

	useEffect(() => {
		const m = mesh.current;
		if (!m) return;
		const o = new THREE.Object3D();
		arrows.forEach((a, i) => {
			const size = 0.5 + Math.min(Math.abs(a.value) / limit, 1) * 1.5;
			o.position.set(a.col, heightAt(a.col, a.row) + LIFT, a.row);
			o.rotation.set(0, a.value >= 0 ? 0 : Math.PI, 0);
			o.scale.setScalar(size * Math.max(1, step / 16));
			o.updateMatrix();
			m.setMatrixAt(i, o.matrix);
		});
		m.count = arrows.length;
		m.instanceMatrix.needsUpdate = true;
	}, [arrows, heightAt, limit, step]);

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
