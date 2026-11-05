import { cn } from "cn";
import { Layers, Mountain } from "lucide-react";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { sequential, symmetricLimit, toCss, vik } from "../lib/colormap";
import { BAND_COLORS, BAND_NAMES, Band } from "../lib/impact";
import type { Layer, Region } from "../manifest";
import {
	DEFORM_FACTORS,
	type DeformFactor,
	type LayerUiState,
	type MapView,
} from "../store";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

const VIEW_HELP: Record<MapView, { title: string; text: string[] }> = {
	cumulative: {
		title: "Acumulado",
		text: ["Cuánto se movió el suelo desde la primera fecha hasta la elegida."],
	},
	velocity: {
		title: "Velocidad",
		text: ["Qué tan rápido se mueve cada punto, usando todas las fechas."],
	},
	zones: {
		title: "Zonas",
		text: [
			"Divide el terreno en zonas más bajas y más altas que al inicio, con su contorno. Reproduce el tiempo para ver cómo crecen.",
			"Cada zona principal marca su punto extremo y su velocidad media. Toca una etiqueta para volar ahí.",
			"«Más alta» significa que se acercó al satélite: también puede ser movimiento horizontal.",
		],
	},
	differential: {
		title: "Diferencial",
		text: [
			"Resalta dónde el terreno se dobla porque un lado baja más que el otro. Ese doblez es lo que suele afectar caminos, canales y tuberías.",
			"Señala un patrón; no es una evaluación de daño.",
		],
	},
	acceleration: {
		title: "Aceleración",
		text: [
			"Compara la primera y la segunda mitad de las fechas para ver dónde el hundimiento se acelera o se frena.",
			"Con menos de dos años de datos puede reflejar ciclos de temporada, no una tendencia real.",
		],
	},
};

interface LayerPanelProps {
	region: Region;
	ui: (layerId: string) => LayerUiState;
	onVisible: (layerId: string, visible: boolean) => void;
	onOpacity: (layerId: string, opacity: number) => void;
	view: MapView;
	onView: (view: MapView) => void;
	/** Límite de color del campo de la vista activa. */
	fieldLimit: number;
	zoneCount: number;
	accelerationAvailable: boolean;
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
	view,
	onView,
	fieldLimit,
	zoneCount,
	accelerationAvailable,
	deform3d,
	deformFactor,
	onDeform3d,
	onDeformFactor,
}: LayerPanelProps) {
	return (
		<Panel className="w-full p-3 sm:w-72">
			<div className="flex items-center justify-between px-1">
				<PanelTitle className="flex items-center gap-1.5">
					<Layers className="size-3.5" aria-hidden /> Capas
				</PanelTitle>
				<InfoHint label="Capas">
					<p>
						Pinta sobre el mapa lo que midió el radar.{" "}
						<strong>Acumulado</strong> muestra cuánto cambió el suelo hasta la
						fecha elegida. <strong>Velocidad</strong> muestra qué tan rápido
						cambia cada año.
					</p>
					<p>Café rojizo: se hunde. Azul: se acerca al satélite.</p>
				</InfoHint>
			</div>
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
										<div className="mt-3 flex items-center justify-between">
											<span className="text-xs text-slate-400">
												Qué muestra el mapa
											</span>
											<InfoHint label={VIEW_HELP[view].title}>
												{VIEW_HELP[view].text.map((t) => (
													<p key={t}>{t}</p>
												))}
											</InfoHint>
										</div>
										<Segmented
											label="Vista del mapa"
											value={view}
											onChange={onView}
											columns={3}
											options={[
												{ value: "cumulative", label: "Acumulado" },
												{ value: "velocity", label: "Velocidad" },
												{ value: "zones", label: "Zonas" },
												{ value: "differential", label: "Diferencial" },
												{
													value: "acceleration",
													label: "Aceleración",
													disabled: !accelerationAvailable,
												},
											]}
										/>
										{!accelerationAvailable && (
											<p className="mt-1 text-xs text-slate-400">
												Aceleración necesita al menos 4 fechas.
											</p>
										)}
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
											view={view}
											fieldLimit={fieldLimit}
											zoneCount={zoneCount}
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
												<span className="flex items-center gap-1">
													<InfoHint label="Hundimiento 3D">
														<p>
															Baja el terreno según el dato para que se vea la
															forma del hundimiento.
														</p>
														<p>
															Los centímetros reales serían invisibles a esta
															escala, por eso se multiplican miles de veces. Las
															alturas de este modo no son reales.
														</p>
													</InfoHint>
													<Switch
														id={`${id}-3d`}
														checked={deform3d}
														onCheckedChange={onDeform3d}
													/>
												</span>
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
	columns,
}: {
	label: string;
	value: T;
	options: Array<{ value: T; label: string; disabled?: boolean }>;
	onChange: (value: T) => void;
	/** Rejilla en vez de una sola fila, para muchas opciones. */
	columns?: 3;
}) {
	return (
		<fieldset className="mt-3">
			<legend className="sr-only">{label}</legend>
			<div
				className={cn(
					"rounded-lg bg-black/30 p-0.5",
					columns ? "grid grid-cols-3 gap-0.5" : "flex",
				)}
			>
				{options.map((o) => (
					<button
						key={String(o.value)}
						type="button"
						aria-pressed={o.value === value}
						disabled={o.disabled}
						onClick={() => onChange(o.value)}
						className={cn(
							"flex-1 rounded-md px-1.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
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

const gradient = (
	scale: (t: number) => [number, number, number],
	flip = false,
) =>
	Array.from({ length: 11 }, (_, i) =>
		toCss(scale(flip ? 1 - i / 10 : i / 10)),
	).join(", ");

const fmt = (v: number) =>
	`${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}`;

const NoDataKey = () => (
	<p className="flex items-center gap-1.5">
		<span className="inline-block size-2.5 rounded-sm bg-[#6f6a75]" /> Sin dato
		(baja coherencia)
	</p>
);

function Bar({
	stops,
	left,
	middle,
	right,
}: {
	stops: string;
	left: string;
	middle?: string;
	right: string;
}) {
	return (
		<>
			<div
				className="h-2.5 rounded-full"
				style={{ background: `linear-gradient(90deg, ${stops})` }}
			/>
			<div className="mt-1 flex justify-between text-[0.7rem] tabular-nums text-slate-300">
				<span>{left}</span>
				{middle && <span>{middle}</span>}
				<span>{right}</span>
			</div>
		</>
	);
}

export function Legend({
	layer,
	view,
	fieldLimit,
	zoneCount,
}: {
	layer: Layer;
	view: MapView;
	fieldLimit: number;
	zoneCount: number;
}) {
	const caption = "mt-2 space-y-1 text-xs leading-relaxed text-slate-400";

	if (view === "zones") {
		const keys = [Band.HIGH, Band.MID, Band.LOW, Band.UP] as const;
		const detail = {
			[Band.HIGH]: "más de 10 cm",
			[Band.MID]: "5 a 10 cm",
			[Band.LOW]: "2 a 5 cm",
			[Band.UP]: "más de 2 cm hacia el satélite",
		};
		return (
			<figure className="mt-3" aria-label="Leyenda de zonas">
				<ul className="space-y-1 text-xs text-slate-200">
					{keys.map((b) => (
						<li key={b} className="flex items-center gap-2">
							<span
								className="inline-block size-3 rounded-sm"
								style={{ background: BAND_COLORS[b] }}
							/>
							<span className="font-semibold">{BAND_NAMES[b]}</span>
							<span className="text-slate-400">{detail[b]}</span>
						</li>
					))}
				</ul>
				<figcaption className={caption}>
					{zoneCount === 0 && (
						<p className="font-semibold text-slate-200">
							Todavía no hay cambio suficiente para marcar zonas en esta fecha.
						</p>
					)}
					<p>Áreas menores a 1 km² no se marcan.</p>
					<NoDataKey />
				</figcaption>
			</figure>
		);
	}

	if (view === "differential") {
		return (
			<figure className="mt-3" aria-label="Leyenda de hundimiento diferencial">
				<Bar
					stops={gradient(sequential)}
					left="0"
					right={`${fieldLimit.toFixed(1)} cm/km`}
				/>
				<figcaption className={caption}>
					<p>
						Más oscuro: el terreno se{" "}
						<strong className="text-slate-200">dobla</strong> más, porque un
						lado baja más que el otro.
					</p>
					<p>Señala un patrón; no es una evaluación de daño.</p>
					<NoDataKey />
				</figcaption>
			</figure>
		);
	}

	if (view === "acceleration") {
		return (
			<figure className="mt-3" aria-label="Leyenda de aceleración">
				<Bar
					stops={gradient(vik, true)}
					left={`Se acelera ${fieldLimit.toFixed(1)}`}
					middle="0"
					right={`Se frena ${fieldLimit.toFixed(1)}`}
				/>
				<figcaption className={caption}>
					<p>
						Compara la velocidad de la segunda mitad de las fechas con la de la
						primera, en cm/año.
					</p>
					<NoDataKey />
				</figcaption>
			</figure>
		);
	}

	const velocity = view === "velocity";
	const limit = velocity ? fieldLimit : symmetricLimit(layer.valueRange);
	const unit = velocity ? "cm/año" : "cm";
	return (
		<figure className="mt-3" aria-label="Leyenda de la capa">
			<Bar
				stops={gradient(vik, true)}
				left={`${fmt(-limit)} ${unit}`}
				middle="0"
				right={`${fmt(limit)} ${unit}`}
			/>
			<figcaption className={caption}>
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
				<NoDataKey />
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
