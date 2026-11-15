import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

interface AgriculturalOutlineProps {
	cells: number[];
	width: number;
	height: number;
	heightAt: (col: number, row: number) => number;
	reducedMotion: boolean;
}

/** Contorno de una sola zona, en las aristas que dan a una celda que no es suya. */
export function AgriculturalOutline({
	cells,
	width,
	height,
	heightAt,
	reducedMotion,
}: AgriculturalOutlineProps) {
	const geometry = useMemo(() => {
		const inside = new Uint8Array(width * height);
		for (const p of cells) inside[p] = 1;
		const positions: number[] = [];
		const edge = (x1: number, z1: number, x2: number, z2: number) => {
			const lift = 0.65;
			positions.push(
				x1,
				heightAt(x1, z1) + lift,
				z1,
				x2,
				heightAt(x2, z2) + lift,
				z2,
			);
		};
		for (const p of cells) {
			const col = p % width;
			const row = (p - col) / width;
			if (col === 0 || !inside[p - 1]) edge(col, row, col, row + 1);
			if (col === width - 1 || !inside[p + 1])
				edge(col + 1, row, col + 1, row + 1);
			if (row === 0 || !inside[p - width]) edge(col, row, col + 1, row);
			if (row === height - 1 || !inside[p + width]) {
				edge(col, row + 1, col + 1, row + 1);
			}
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(positions, 3),
		);
		return geo;
	}, [cells, width, height, heightAt]);
	const material = useRef<THREE.LineBasicMaterial>(null);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useFrame((state) => {
		const line = material.current;
		if (!line) return;
		line.opacity = reducedMotion
			? 1
			: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4));
	});
	return (
		<lineSegments
			geometry={geometry}
			frustumCulled={false}
			raycast={() => null}
		>
			<lineBasicMaterial
				ref={material}
				color="#4ade80"
				transparent
				opacity={1}
			/>
		</lineSegments>
	);
}
