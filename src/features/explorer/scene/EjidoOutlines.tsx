import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Ejido } from "../lib/ejidos";

type EjidoOutlinesProps = {
	ejidos: Ejido[];
	heightAt: (col: number, row: number) => number;
};

const LIFT = 0.55;

const pushEdge = (
	positions: number[],
	heightAt: (col: number, row: number) => number,
	x1: number,
	z1: number,
	x2: number,
	z2: number,
) => {
	positions.push(x1, heightAt(x1, z1) + LIFT, z1, x2, heightAt(x2, z2) + LIFT, z2);
};

/** Linderos de los núcleos agrarios, un solo lote de líneas sobre el terreno. */
export const EjidoOutlines = ({ ejidos, heightAt }: EjidoOutlinesProps) => {
	const geometry = useMemo(() => {
		const positions: number[] = [];
		for (const ejido of ejidos) {
			for (const ring of ejido.rings) {
				for (let i = 1; i < ring.length; i++) {
					const a = ring[i - 1];
					const b = ring[i];
					if (!a || !b) continue;
					pushEdge(positions, heightAt, a[0], a[1], b[0], b[1]);
				}
			}
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		return geo;
	}, [ejidos, heightAt]);
	useEffect(() => () => geometry.dispose(), [geometry]);
	return (
		<lineSegments geometry={geometry} frustumCulled={false} raycast={() => null}>
			<lineBasicMaterial color="#fbbf24" transparent opacity={0.85} />
		</lineSegments>
	);
};
