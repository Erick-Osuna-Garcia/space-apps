import { useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Component, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CropId } from "../lib/mapModels";

/** Los ocho modelos de `public/models/crops`, en el orden del valle. */
export const MODEL_CATALOG: Array<{
	id: CropId;
	file: string;
	label: string;
	why: string;
}> = [
	{
		id: "esparrago",
		file: "esparrago.glb",
		label: "Espárrago",
		why: "Cultivo de exportación del valle. Aparece en pocos grupos de la clase Cultivos, no en cada parcela.",
	},
	{
		id: "datil",
		file: "palma_datilera.glb",
		label: "Palma datilera",
		why: "El dátil se cultiva en el valle. La palma marca algunos grupos; el mapa no dice que esa parcela sea un datilar.",
	},
	{
		id: "trigo",
		file: "trigo.glb",
		label: "Trigo",
		why: "Es de los cultivos con más superficie, así que ocupa más grupos que el resto. Sigue siendo una ilustración, no un censo.",
	},
	{
		id: "brocoli",
		file: "brocoli.glb",
		label: "Brócoli",
		why: "Hortaliza de invierno del valle. Solo entra en grupos chicos de la clase Cultivos de 2021.",
	},
	{
		id: "sorgo",
		file: "sorgo.glb",
		label: "Sorgo",
		why: "Cereal del valle. Se sienta sobre la misma clase Cultivos, en menos grupos que el trigo.",
	},
	{
		id: "alfalfa",
		file: "alfalfa.glb",
		label: "Alfalfa",
		why: "Forraje de gran superficie, al nivel del trigo. Por eso hay más grupos de alfalfa que de hortaliza.",
	},
	{
		id: "algodon",
		file: "algodon.glb",
		label: "Algodón",
		why: "Cultivo histórico del valle. Tiene menos grupos que el trigo y la alfalfa.",
	},
	{
		id: "cebolla",
		file: "cebolla.glb",
		label: "Cebolla",
		why: "Hortaliza del valle. El modelo no identifica la cebolla de esa parcela; solo ilustra el grupo.",
	},
];

interface ModelsPanelProps {
	selected: CropId | null;
	counts: Partial<Record<CropId, number>>;
	reducedMotion: boolean;
	onSelect: (id: CropId) => void;
}

export function ModelsPanel({
	selected,
	counts,
	reducedMotion,
	onSelect,
}: ModelsPanelProps) {
	const active =
		MODEL_CATALOG.find((model) => model.id === selected) ?? null;
	return (
		<div className="space-y-3">
			<p>
				Estas figuras no las midió el radar. Se sientan sobre la clase Cultivos
				de ESA WorldCover 2021 cuando Cultivos está abierto. Un bloque grande
				lleva de una a cinco, y todo el grupo es la misma variante.
			</p>
			{active ? (
				<ModelView file={active.file} reducedMotion={reducedMotion} />
			) : (
				<p className="rounded-xl bg-white/5 px-3 py-6 text-center text-slate-400 text-xs">
					Elige un modelo para verlo y volar a su grupo.
				</p>
			)}
			{active && (
				<p>
					<span className="font-semibold text-white">{active.label}. </span>
					{active.why}{" "}
					<span className="tabular-nums text-slate-400">
						{counts[active.id]
							? `${counts[active.id]} en el mapa.`
							: "Se colocan al abrir Cultivos."}
					</span>
				</p>
			)}
			<ul className="grid grid-cols-2 gap-2">
				{MODEL_CATALOG.map((model) => {
					const on = model.id === selected;
					return (
						<li key={model.id}>
							<button
								type="button"
								aria-pressed={on}
								onClick={() => onSelect(model.id)}
								className={`min-h-11 w-full rounded-xl border px-2.5 py-2 text-left transition-[background-color,border-color] focus-visible:outline-2 focus-visible:outline-cyan-300 ${
									on
										? "border-cyan-300 bg-cyan-400/20 text-cyan-50"
										: "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
								}`}
							>
								<span className="block font-semibold text-sm">
									{model.label}
								</span>
								<span className="mt-0.5 block text-pretty text-[0.7rem] text-slate-400">
									{model.why}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function ModelView({
	file,
	reducedMotion,
}: {
	file: string;
	reducedMotion: boolean;
}) {
	return (
		<PreviewBoundary key={file}>
			<div className="h-40 overflow-hidden rounded-xl bg-[#071018]">
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
}

function Spin({
	reducedMotion,
	children,
}: {
	reducedMotion: boolean;
	children: React.ReactNode;
}) {
	const ref = useRef<THREE.Group>(null);
	useFrame((_, dt) => {
		if (reducedMotion || !ref.current) return;
		ref.current.rotation.y += dt * 0.55;
	});
	return <group ref={ref}>{children}</group>;
}

function FitModel({ url }: { url: string }) {
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
}

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
				<p className="rounded-xl bg-white/5 px-3 py-6 text-center text-amber-200 text-xs">
					No se pudo mostrar este modelo. El archivo sigue en modelos de
					cultivos.
				</p>
			);
		}
		return this.props.children;
	}
}
