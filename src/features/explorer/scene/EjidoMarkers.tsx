import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { ejidoKey, type Ejido } from "../lib/ejidos";
import { placeLabel } from "./placeLabel";
import { MAP_SCALE } from "./terrainGeometry";

const LABEL_HEIGHT = 6 / MAP_SCALE;

type EjidoMarkersProps = {
	ejidos: Ejido[];
	heightAt: (col: number, row: number) => number;
	labels: React.RefObject<Map<string, HTMLElement>>;
};

/** Proyecta el nombre de cada ejido sobre su centroide. */
export const EjidoMarkers = ({
	ejidos,
	heightAt,
	labels,
}: EjidoMarkersProps) => {
	const { camera, size } = useThree();
	const v = useRef(new THREE.Vector3());

	useFrame(() => {
		for (let i = 0; i < ejidos.length; i++) {
			const ejido = ejidos[i];
			if (!ejido) continue;
			const el = labels.current?.get(ejidoKey(ejido, i));
			if (!el) continue;
			v.current.set(
				ejido.col,
				heightAt(ejido.col, ejido.row) + LABEL_HEIGHT,
				ejido.row,
			);
			placeLabel(el, v.current, camera, size);
		}
	});

	return null;
};
