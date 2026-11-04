import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KeyAxes } from "../controls/useKeyboard";
import { screenToWorld } from "../lib/grid";
import { stepFlight, useFlight } from "./flight";
import { HOVER_HEIGHT } from "./terrainGeometry";

const HULL = "#e8edf2";
const ACCENT = "#f59e0b";
const GLOW = "#67e8f9";

/** Nave low-poly hecha con primitivas (sin assets externos). */
function ShipModel() {
	return (
		<group scale={1.6}>
			{/* casco: proa hacia -z local */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
				<coneGeometry args={[0.9, 3.6, 6]} />
				<meshStandardMaterial
					color={HULL}
					flatShading
					metalness={0.3}
					roughness={0.45}
				/>
			</mesh>
			{/* cabina */}
			<mesh position={[0, 0.45, -0.3]}>
				<sphereGeometry args={[0.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
				<meshStandardMaterial
					color="#38bdf8"
					emissive="#0c4a6e"
					roughness={0.15}
					metalness={0.6}
				/>
			</mesh>
			{/* alas */}
			<mesh position={[0, -0.1, 0.7]} castShadow>
				<boxGeometry args={[4.2, 0.12, 1.1]} />
				<meshStandardMaterial
					color={HULL}
					flatShading
					metalness={0.3}
					roughness={0.5}
				/>
			</mesh>
			{[-2.05, 2.05].map((x) => (
				<mesh key={x} position={[x, 0.15, 0.85]}>
					<boxGeometry args={[0.14, 0.55, 0.9]} />
					<meshStandardMaterial color={ACCENT} flatShading />
				</mesh>
			))}
			{/* motor */}
			<mesh position={[0, 0, 1.85]}>
				<cylinderGeometry args={[0.35, 0.45, 0.4, 8]} />
				<meshStandardMaterial
					color={GLOW}
					emissive={GLOW}
					emissiveIntensity={2.5}
					toneMapped={false}
				/>
			</mesh>
		</group>
	);
}

interface ShipProps {
	keys: React.RefObject<KeyAxes>;
	reducedMotion: boolean;
}

export function Ship({ keys, reducedMotion }: ShipProps) {
	const flight = useFlight();
	const group = useRef<THREE.Group>(null);
	const body = useRef<THREE.Group>(null);

	useFrame((state, rawDt) => {
		const dt = Math.min(rawDt, 1 / 20); // evita saltos tras pestañas inactivas
		const k = keys.current ?? { right: 0, forward: 0, boost: false };
		const [dx, dz] = screenToWorld(k.right, k.forward);
		stepFlight(flight, { dx, dz, boost: k.boost }, dt);

		const groundY = flight.heightAt(flight.col, flight.row) + HOVER_HEIGHT;
		flight.y += (groundY - flight.y) * Math.min(1, dt * 6);

		const speed = Math.hypot(flight.vx, flight.vz);
		if (speed > 0.5) {
			const desired = Math.atan2(-flight.vx, -flight.vz);
			let diff = desired - flight.heading;
			diff = Math.atan2(Math.sin(diff), Math.cos(diff));
			flight.heading += diff * Math.min(1, dt * 6);
			flight.bank += (-diff * 0.9 - flight.bank) * Math.min(1, dt * 5);
		} else {
			flight.bank *= Math.exp(-4 * dt);
		}

		const g = group.current;
		if (g) {
			g.position.set(flight.col, flight.y, flight.row);
			g.rotation.y = flight.heading;
		}
		const b = body.current;
		if (b) {
			b.rotation.z = flight.bank;
			b.position.y = reducedMotion
				? 0
				: Math.sin(state.clock.elapsedTime * 2.2) * 0.35;
		}
	});

	return (
		<>
			{!reducedMotion && <ShipTrail />}
			<group ref={group}>
				<group ref={body}>
					<ShipModel />
				</group>
				{/* resplandor del motor sobre el terreno: ayuda a ubicar la nave */}
				<pointLight
					color={GLOW}
					intensity={30}
					distance={22}
					position={[0, -2, 2.5]}
				/>
			</group>
		</>
	);
}

const TRAIL_POINTS = 48;
const TRAIL_SAMPLE_S = 0.035;

/** Estela: línea con las últimas posiciones de la nave en coordenadas de mundo, desvaneciéndose. */
function ShipTrail() {
	const flight = useFlight();
	const acc = useRef(0);
	const line = useMemo(() => {
		const positions = new Float32Array(TRAIL_POINTS * 3);
		const colors = new Float32Array(TRAIL_POINTS * 4);
		const glow = new THREE.Color(GLOW);
		for (let i = 0; i < TRAIL_POINTS; i++) {
			const a = (1 - i / (TRAIL_POINTS - 1)) ** 2;
			colors.set([glow.r, glow.g, glow.b, a * 0.9], i * 4);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
		const mat = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			depthWrite: false,
		});
		return new THREE.Line(geo, mat);
	}, []);
	useEffect(
		() => () => {
			line.geometry.dispose();
			(line.material as THREE.Material).dispose();
		},
		[line],
	);

	useFrame((_, dt) => {
		const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
		const arr = pos.array as Float32Array;
		// tras un teletransporte la estela se reinicia en la nave (sin línea desde el origen)
		const reset = flight.snap || arr[0] === 0;
		acc.current += dt;
		if (!reset && acc.current < TRAIL_SAMPLE_S) return;
		acc.current = 0;
		const tail = Math.sin(flight.heading);
		const tailZ = Math.cos(flight.heading);
		const x = flight.col + tail * 3;
		const y = flight.y;
		const z = flight.row + tailZ * 3;
		if (reset) {
			for (let i = 0; i < TRAIL_POINTS; i++) arr.set([x, y, z], i * 3);
		} else {
			arr.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
			arr.set([x, y, z], 0);
		}
		pos.needsUpdate = true;
		line.geometry.computeBoundingSphere();
	});

	return <primitive object={line} />;
}
