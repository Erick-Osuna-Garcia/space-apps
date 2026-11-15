import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
	CROP_VARIANTS,
	type MapModel,
	type MapModelKind,
	parkedModel,
} from "../lib/mapModels";
import { Panel } from "./Panel";

const CROP_FILE: Partial<Record<string, string>> = {
	esparrago: "esparrago.glb",
	datil: "palma_datilera.glb",
	trigo: "trigo.glb",
	brocoli: "brocoli.glb",
	sorgo: "sorgo.glb",
	alfalfa: "alfalfa.glb",
	algodon: "algodon.glb",
	cebolla: "cebolla.glb",
};

const KIND_LABEL: Record<MapModelKind, string> = {
	...Object.fromEntries(CROP_VARIANTS.map((v) => [v.id, v.label])),
	house: "Casa",
	building: "Edificio",
	car: "Auto",
} as Record<MapModelKind, string>;

type ParkedModelViewProps = {
	models: MapModel[];
	probe: { col: number; row: number; vx?: number; vz?: number } | null;
	reducedMotion: boolean;
};

export const ParkedModelView = ({
	models,
	probe,
	reducedMotion,
}: ParkedModelViewProps) => {
	const hit = parkedModel(models, probe);
	const file = hit ? CROP_FILE[hit.kind] : undefined;
	return (
		<Panel
			role="complementary"
			aria-label="Modelo bajo la nave"
			className="w-[min(100%,16rem)] shrink-0 overflow-hidden"
		>
			<p className="border-b border-white/10 px-3 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400">
				{hit ? KIND_LABEL[hit.kind] : "Sin modelo"}
			</p>
			{hit && file ? (
				<GlbPreview file={file} reducedMotion={reducedMotion} />
			) : hit ? (
				<PrimitivePreview kind={hit.kind} reducedMotion={reducedMotion} />
			) : (
				<p className="px-3 py-6 text-center text-slate-400 text-xs">
					No hay modelo en este punto. Párate junto a un cultivo, una casa o un
					auto.
				</p>
			)}
		</Panel>
	);
};

const GlbPreview = ({
	file,
	reducedMotion,
}: {
	file: string;
	reducedMotion: boolean;
}) => (
	<PreviewBoundary>
		<div className="h-36 overflow-hidden bg-[#071018]">
			<Canvas
				camera={{ position: [0, 0.7, 2.5], fov: 32 }}
				dpr={[1, 1.5]}
				gl={{ antialias: true }}
				frameloop={reducedMotion ? "demand" : "always"}
			>
				<ambientLight intensity={0.7} />
				<directionalLight position={[2, 3, 2]} intensity={1.6} />
				<Suspense fallback={null}>
					<Spin reducedMotion={reducedMotion}>
						<FitModel url={`/models/crops/${file}`} />
					</Spin>
				</Suspense>
			</Canvas>
		</div>
	</PreviewBoundary>
);

const PrimitivePreview = ({
	kind,
	reducedMotion,
}: {
	kind: MapModelKind;
	reducedMotion: boolean;
}) => (
	<div className="h-36 overflow-hidden bg-[#071018]">
		<Canvas
			camera={{ position: [1.6, 1.4, 1.6], fov: 40 }}
			dpr={[1, 1.5]}
			gl={{ antialias: true }}
			frameloop={reducedMotion ? "demand" : "always"}
		>
			<ambientLight intensity={0.7} />
			<directionalLight position={[2, 3, 2]} intensity={1.6} />
			<Spin reducedMotion={reducedMotion}>
				<StandIn kind={kind} />
			</Spin>
		</Canvas>
	</div>
);

const Spin = ({
	reducedMotion,
	children,
}: {
	reducedMotion: boolean;
	children: React.ReactNode;
}) => {
	const ref = useRef<THREE.Group>(null);
	useFrame((_, dt) => {
		if (reducedMotion || !ref.current) return;
		ref.current.rotation.y += dt * 0.55;
	});
	return <group ref={ref}>{children}</group>;
};

const FitModel = ({ url }: { url: string }) => {
	const { scene } = useGLTF(url);
	const clone = useMemo(() => scene.clone(true), [scene]);
	useLayoutEffect(() => {
		clone.scale.setScalar(1);
		clone.position.set(0, 0, 0);
		clone.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(clone);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const max = Math.max(size.x, size.y, size.z, 1e-4);
		const scale = 1.5 / max;
		clone.scale.setScalar(scale);
		clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
	}, [clone]);
	return <primitive object={clone} />;
};

const StandIn = ({ kind }: { kind: MapModelKind }) => {
	if (kind === "house") {
		return (
			<group>
				<mesh position={[0, 0.28, 0]}>
					<boxGeometry args={[0.95, 0.55, 0.75]} />
					<meshStandardMaterial color="#e7e5e4" />
				</mesh>
				<mesh position={[0, 0.76, 0]} rotation={[0, Math.PI / 4, 0]}>
					<coneGeometry args={[0.72, 0.42, 4]} />
					<meshStandardMaterial color="#c2410c" />
				</mesh>
			</group>
		);
	}
	if (kind === "building") {
		return (
			<mesh position={[0, 1.05, 0]}>
				<boxGeometry args={[0.62, 2.1, 0.62]} />
				<meshStandardMaterial color="#94a3b8" />
			</mesh>
		);
	}
	if (kind === "car") {
		return (
			<group>
				<mesh position={[0.1, 0.22, 0]}>
					<boxGeometry args={[1.15, 0.32, 0.52]} />
					<meshStandardMaterial color="#f8fafc" />
				</mesh>
				<mesh position={[-0.05, 0.5, 0]}>
					<boxGeometry args={[0.48, 0.28, 0.42]} />
					<meshStandardMaterial color="#38bdf8" />
				</mesh>
			</group>
		);
	}
	return (
		<mesh position={[0, 0.45, 0]}>
			<cylinderGeometry args={[0.05, 0.08, 0.9, 6]} />
			<meshStandardMaterial color="#a16207" />
		</mesh>
	);
};

class PreviewBoundary extends Component<
	{ children: React.ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		if (this.state.failed) {
			return (
				<p className="px-3 py-6 text-center text-amber-200 text-xs">
					No se pudo mostrar este modelo.
				</p>
			);
		}
		return this.props.children;
	}
}
