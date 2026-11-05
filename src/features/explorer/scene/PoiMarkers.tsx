import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Poi } from "../manifest";
import { placeLabel } from "./placeLabel";
import { MAP_SCALE } from "./terrainGeometry";

const LABEL_HEIGHT = 20 / MAP_SCALE;

interface PoiMarkersProps {
	pois: Poi[];
	heightAt: (col: number, row: number) => number;
	/** Elementos DOM de las etiquetas (fuera del Canvas), por id de POI. */
	labels: React.RefObject<Map<string, HTMLElement>>;
}

/**
 * Faros de los puntos de interés. Las etiquetas viven en la HUD (DOM normal) y aquí solo se
 * proyecta su posición cada cuadro: más robusto que montar un root de React por etiqueta.
 */
export function PoiMarkers({ pois, heightAt, labels }: PoiMarkersProps) {
	const { camera, size } = useThree();
	const v = useRef(new THREE.Vector3());

	useFrame(() => {
		for (const poi of pois) {
			const el = labels.current?.get(poi.id);
			if (!el) continue;
			v.current.set(
				poi.col,
				heightAt(poi.col, poi.row) + LABEL_HEIGHT,
				poi.row,
			);
			placeLabel(el, v.current, camera, size);
		}
	});

	return (
		<>
			{pois.map((poi) => {
				const y = heightAt(poi.col, poi.row);
				return (
					<group key={poi.id} position={[poi.col, y, poi.row]}>
						<mesh position={[0, LABEL_HEIGHT / 2 - 0.5, 0]}>
							<cylinderGeometry args={[0.1, 0.1, LABEL_HEIGHT - 1, 6]} />
							<meshBasicMaterial color="#fbbf24" transparent opacity={0.55} />
						</mesh>
						<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
							<ringGeometry args={[0.75, 1, 24]} />
							<meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
						</mesh>
					</group>
				);
			})}
		</>
	);
}
