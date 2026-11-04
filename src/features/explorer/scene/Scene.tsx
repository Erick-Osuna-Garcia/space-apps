import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { KeyAxes } from "../controls/useKeyboard";
import { gridToLonLat } from "../lib/grid";
import type { Layer, Region } from "../manifest";
import type { ExplorerStore } from "../store";
import { useFlight } from "./flight";
import { IsoCamera } from "./IsoCamera";
import { PoiMarkers } from "./PoiMarkers";
import { Ship } from "./Ship";
import { Terrain } from "./Terrain";

const PROBE_INTERVAL_S = 0.1;

/** Publica la posición de la nave al store ~10 veces por segundo (para la sonda). */
function ProbePublisher({
	region,
	store,
}: {
	region: Region;
	store: ExplorerStore;
}) {
	const flight = useFlight();
	const acc = useRef(0);
	const last = useRef({ col: -1, row: -1 });
	useFrame((_, dt) => {
		acc.current += dt;
		if (acc.current < PROBE_INTERVAL_S) return;
		acc.current = 0;
		const col = Math.round(flight.col * 10) / 10;
		const row = Math.round(flight.row * 10) / 10;
		if (col === last.current.col && row === last.current.row) return;
		last.current = { col, row };
		const [lon, lat] = gridToLonLat(region, flight.col, flight.row);
		store.actions.setProbe({ col: flight.col, row: flight.row, lon, lat });
	});
	return null;
}

export interface SceneProps {
	region: Region;
	heights: Int16Array;
	exaggeration: number;
	step: number;
	layer: Layer | null;
	cube: Int16Array | null;
	layerVisible: boolean;
	layerOpacity: number;
	dateIndex: number;
	reducedMotion: boolean;
	heightAt: (col: number, row: number) => number;
	velocity: Float32Array | null;
	velocityLimit: number;
	colorMode: "cumulative" | "velocity";
	deformScale: number;
	deformCube: Float32Array | null;
	keys: React.RefObject<KeyAxes>;
	labels: React.RefObject<Map<string, HTMLElement>>;
	store: ExplorerStore;
}

export function Scene(props: SceneProps) {
	const { region } = props;
	return (
		<>
			<color attach="background" args={["#05070f"]} />
			<Stars
				radius={600}
				depth={200}
				count={2500}
				factor={6}
				fade
				speed={props.reducedMotion ? 0 : 0.4}
			/>
			<hemisphereLight args={["#cfe3ff", "#3b2a1f", 0.75]} />
			<directionalLight
				position={[-300, 420, 160]}
				intensity={2.1}
				color="#fff1dc"
			/>
			<IsoCamera
				regionSize={Math.max(region.width, region.height)}
				reducedMotion={props.reducedMotion}
			/>
			<Terrain
				region={region}
				heights={props.heights}
				exaggeration={props.exaggeration}
				step={props.step}
				layer={props.layer}
				cube={props.cube}
				visible={props.layerVisible}
				opacity={props.layerOpacity}
				dateIndex={props.dateIndex}
				reducedMotion={props.reducedMotion}
				velocity={props.velocity}
				velocityLimit={props.velocityLimit}
				colorMode={props.colorMode}
				deformScale={props.deformScale}
				deformCube={props.deformCube}
			/>
			<PoiMarkers
				pois={region.pois}
				heightAt={props.heightAt}
				labels={props.labels}
			/>
			<Ship keys={props.keys} reducedMotion={props.reducedMotion} />
			<ProbePublisher region={region} store={props.store} />
		</>
	);
}
