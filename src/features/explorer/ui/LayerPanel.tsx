import { cn } from "cn";
import { Layers, Mountain } from "lucide-react";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { symmetricLimit, toCss, vik } from "../lib/colormap";
import type { Layer, Region } from "../manifest";
import {
	type ColorMode,
	DEFORM_FACTORS,
	type DeformFactor,
	type LayerUiState,
} from "../store";
import { Panel, PanelTitle } from "./Panel";

interface LayerPanelProps {
	region: Region;
	ui: (layerId: string) => LayerUiState;
	onVisible: (layerId: string, visible: boolean) => void;
	onOpacity: (layerId: string, opacity: number) => void;
	colorMode: ColorMode;
	onColorMode: (mode: ColorMode) => void;
	velocityLimit: number;
	deform3d: boolean;
	deformFactor: DeformFactor;
	onDeform3d: (on: boolean) => void;
	onDeformFactor: (factor: DeformFactor) => void;
}

export function LayerPanel({
	region,
	ui,
	onVisible,
	onOpacity,
	colorMode,
	onColorMode,
	velocityLimit,
	deform3d,
	deformFactor,
	onDeform3d,
	onDeformFactor,
}: LayerPanelProps) {
	return (
		<Panel className="w-full p-3 sm:w-72">
			<PanelTitle className="flex items-center gap-1.5 px-1">
				<Layers className="size-3.5" aria-hidden /> Capas
			</PanelTitle>
			{region.layers.length === 0 ? (
				<p className="mt-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-300">
					Los fenómenos de esta región (expansión urbana, Río Tijuana) llegarán
					próximamente. Por ahora puedes explorar su relieve.
				</p>
			) : (
				<div className="mt-2 space-y-3">
					{region.layers.map((layer) => {
						const state = ui(layer.id);
						const id = `layer-${layer.id}`;
						return (
							<div key={layer.id} className="rounded-xl bg-white/5 px-3 py-2.5">
								<div className="flex items-center justify-between gap-3">
									<label
										htmlFor={id}
										className="text-sm font-semibold text-slate-100"
									>
										{layer.name}
									</label>
									<Switch
										id={id}
										checked={state.visible}
										onCheckedChange={(v) => onVisible(layer.id, v)}
									/>
								</div>
								{state.visible && (
									<>
										<Segmented
											label="Color"
											value={colorMode}
											onChange={onColorMode}
											options={[
												{ value: "cumulative", label: "Acumulado" },
												{ value: "velocity", label: "Velocidad" },
											]}
										/>
										<div className="mt-3 flex items-center gap-3">
											<span className="text-xs text-slate-400">Opacidad</span>
											<Slider
												aria-label={`Opacidad de ${layer.name}`}
												min={0}
												max={1}
												step={0.05}
												value={[state.opacity]}
												onValueChange={([v]) => onOpacity(layer.id, v)}
											/>
										</div>
										<Legend
											layer={layer}
											mode={colorMode}
											velocityLimit={velocityLimit}
										/>
										<div className="mt-3 border-t border-white/10 pt-3">
											<div className="flex items-center justify-between gap-3">
												<label
													htmlFor={`${id}-3d`}
													className="flex items-center gap-1.5 text-sm font-semibold text-slate-100"
												>
													<Mountain className="size-3.5" aria-hidden />
													Hundimiento 3D
												</label>
												<Switch
													id={`${id}-3d`}
													checked={deform3d}
													onCheckedChange={onDeform3d}
												/>
											</div>
											{deform3d && (
												<Segmented
													label="Exageración"
													value={deformFactor}
													onChange={onDeformFactor}
													options={DEFORM_FACTORS.map((f) => ({
														value: f,
														label: `×${f.toLocaleString("es-MX")}`,
													}))}
												/>
											)}
											<p className="mt-1.5 text-xs leading-relaxed text-slate-400">
												Hunde la superficie según el dato, muy exagerado: solo
												ilustrativo.
											</p>
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>
			)}
		</Panel>
	);
}

export function Segmented<T extends string | number>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (value: T) => void;
}) {
	return (
		<fieldset className="mt-3">
			<legend className="sr-only">{label}</legend>
			<div className="flex rounded-lg bg-black/30 p-0.5">
				{options.map((o) => (
					<button
						key={String(o.value)}
						type="button"
						aria-pressed={o.value === value}
						onClick={() => onChange(o.value)}
						className={cn(
							"flex-1 rounded-md px-2 py-1 text-xs font-semibold transition",
							o.value === value
								? "bg-cyan-400 text-slate-950"
								: "text-slate-300 hover:text-white",
						)}
					>
						{o.label}
					</button>
				))}
			</div>
		</fieldset>
	);
}

export function Legend({
	layer,
	mode,
	velocityLimit,
}: {
	layer: Layer;
	mode: ColorMode;
	velocityLimit: number;
}) {
	const velocity = mode === "velocity";
	const limit = velocity ? velocityLimit : symmetricLimit(layer.valueRange);
	const unit = velocity ? "cm/año" : "cm";
	// izquierda = negativo (hundimiento), derecha = positivo (acercamiento)
	const stops = Array.from({ length: 11 }, (_, i) =>
		toCss(vik(1 - i / 10)),
	).join(", ");
	const fmt = (v: number) =>
		`${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}`;
	return (
		<figure className="mt-3" aria-label="Leyenda de la capa">
			<div
				className="h-2.5 rounded-full"
				style={{ background: `linear-gradient(90deg, ${stops})` }}
			/>
			<div className="mt-1 flex justify-between text-[0.7rem] tabular-nums text-slate-300">
				<span>
					{fmt(-limit)} {unit}
				</span>
				<span>0</span>
				<span>
					{fmt(limit)} {unit}
				</span>
			</div>
			<figcaption className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
				{velocity ? (
					<p>
						<strong className="text-slate-200">Velocidad</strong>: tendencia
						lineal de cada punto en todas las fechas, en línea de vista (LOS).
					</p>
				) : (
					<p>
						Desplazamiento acumulado en{" "}
						<strong className="text-slate-200">línea de vista</strong> (LOS) del
						radar desde la primera fecha.
					</p>
				)}
				<p>
					<span className="font-semibold text-orange-300">Negativo</span>: el
					suelo se aleja del satélite (hundimiento).{" "}
					<span className="font-semibold text-sky-300">Positivo</span>: se
					acerca.
				</p>
				<p className="flex items-center gap-1.5">
					<span className="inline-block size-2.5 rounded-sm bg-[#6f6a75]" /> Sin
					dato (baja coherencia)
				</p>
				{!velocity && (
					<p className="tabular-nums">
						Rango observado: {layer.valueRange[0].toFixed(1)} a{" "}
						{layer.valueRange[1].toFixed(1)} cm
					</p>
				)}
			</figcaption>
		</figure>
	);
}
