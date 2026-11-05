import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { BAND_COLORS, type Zone } from "../lib/impact";
import { placeLabel } from "./placeLabel";

const MARKER_HEIGHT = 14;

interface ZoneMarkersProps {
	/** Zonas principales, ya limitadas; su índice es la clave estable de la etiqueta. */
	zones: Zone[];
	heightAt: (col: number, row: number) => number;
	labels: React.RefObject<Map<string, HTMLElement>>;
}

/** Faro en el punto extremo de cada zona principal; su etiqueta vive en la HUD. */
export function ZoneMarkers({ zones, heightAt, labels }: ZoneMarkersProps) {
	const { camera, size } = useThree();
	const v = useRef(new THREE.Vector3());

	useFrame(() => {
		zones.forEach((zone, rank) => {
			const el = labels.current?.get(String(rank));
			if (!el) return;
			v.current.set(
				zone.col,
				heightAt(zone.col, zone.row) + MARKER_HEIGHT,
				zone.row,
			);
			placeLabel(el, v.current, camera, size);
		});
	});

	return (
		<>
			{zones.map((zone, rank) => (
				<group
					// el índice es estable: el marcador se mueve con la fecha en vez de remontarse
					// biome-ignore lint/suspicious/noArrayIndexKey: ver comentario
					key={rank}
					position={[zone.col, heightAt(zone.col, zone.row), zone.row]}
				>
					<mesh position={[0, MARKER_HEIGHT / 2 - 1, 0]}>
						<cylinderGeometry args={[0.3, 0.3, MARKER_HEIGHT - 2, 6]} />
						<meshBasicMaterial color={BAND_COLORS[zone.band]} />
					</mesh>
					<mesh position={[0, 0.8, 0]}>
						<octahedronGeometry args={[1.6]} />
						<meshBasicMaterial color={BAND_COLORS[zone.band]} />
					</mesh>
				</group>
			))}
		</>
	);
}
