import { useEffect, useMemo } from "react";
import * as THREE from "three";

interface AgriculturalOutlineProps {
	cells: number[];
	width: number;
	height: number;
	heightAt: (col: number, row: number) => number;
}

/** Contorno de una sola zona, en las aristas que dan a una celda que no es suya. */
export function AgriculturalOutline({
	cells,
	width,
	height,
	heightAt,
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
	useEffect(() => () => geometry.dispose(), [geometry]);
	return (
		<lineSegments
			geometry={geometry}
			frustumCulled={false}
			raycast={() => null}
		>
			<lineBasicMaterial color="#fef08a" />
		</lineSegments>
	);
}
