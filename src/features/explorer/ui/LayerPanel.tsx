import { cn } from "cn";
import { Layers } from "lucide-react";
import { useState } from "react";
import { type CatalogItem, THEMES, type Theme } from "../lib/catalog";
import {
	PALETTES,
	sequential,
	symmetricLimit,
	toCss,
	vik,
} from "../lib/colormap";
import { BAND_COLORS, BAND_NAMES, Band } from "../lib/impact";
import type { Layer } from "../manifest";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

export const VIEW_HELP = {
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
			"Son zonas de movimiento del suelo, no las de Cultivos. Cada zona principal marca su punto extremo y su velocidad media. Toca una etiqueta para volar ahí.",
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
} as const satisfies Record<string, { title: string; text: readonly string[] }>;

interface LayerPanelProps {
	catalog: CatalogItem[];
	active: CatalogItem | null;
	onSelect: (item: CatalogItem) => void;
	/** Capa de desplazamiento, si la región la tiene. */
	displacement: Layer | null;
	visible: boolean;
	loading: boolean;
	failed: boolean;
	/** Límite de color del campo de la vista activa. */
	fieldLimit: number;
	zoneCount: number;
}

export function LayerPanel({
	catalog,
	active,
	onSelect,
	displacement,
	visible,
	loading,
	failed,
	fieldLimit,
	zoneCount,
}: LayerPanelProps) {
	const themes = THEMES.filter((t) => catalog.some((i) => i.theme === t.id));
	const [pickedTheme, setTheme] = useState<Theme | null>(null);
	const theme = pickedTheme ?? active?.theme ?? themes[0]?.id;
	const help = active?.layer
		? { title: active.layer.name, text: [active.layer.description] }
		: active
			? VIEW_HELP[active.view as keyof typeof VIEW_HELP]
			: null;
	return (
		<Panel className="w-full p-3 sm:w-72">
			<div className="flex items-center justify-between px-1">
				<PanelTitle className="flex items-center gap-1.5">
					<Layers className="size-3.5" aria-hidden /> Capas
				</PanelTitle>
				{catalog.length > 0 && help && (
					<InfoHint label={help.title}>
						{help.text.map((t) => (
							<p key={t}>{t}</p>
						))}
					</InfoHint>
				)}
			</div>
			{catalog.length === 0 ? (
				<p className="mt-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-300">
					Aún no hay capas para esta región. Por ahora puedes explorar su
					relieve.
				</p>
			) : (
				<>
					<Segmented
						label="Tema"
						value={theme}
						onChange={setTheme}
						options={themes.map((t) => ({ value: t.id, label: t.label }))}
					/>
					<ul className="mt-2 space-y-0.5">
						{catalog
							.filter((i) => i.theme === theme)
							.map((item) => (
								<li key={item.view}>
									<button
										type="button"
										disabled={item.disabled}
										aria-pressed={item.view === active?.view}
										onClick={() => onSelect(item)}
										className={cn(
											"min-h-11 w-full rounded-lg px-2.5 py-2 text-left font-semibold text-sm transition-[color,background-color] focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5",
											item.view === active?.view
												? "bg-cyan-400 text-slate-950"
												: "text-slate-200 hover:bg-white/10",
										)}
									>
										{item.name}
									</button>
								</li>
							))}
					</ul>
					{loading && (
						<p className="mt-2 px-1 text-slate-300 text-xs">Cargando capa…</p>
					)}
					{failed && (
						<p className="mt-2 px-1 text-amber-200 text-xs">
							No se pudo cargar esta capa. El mapa conserva la anterior.
						</p>
					)}
					{visible && active && (
						<div className="mt-2 rounded-xl bg-white/5 px-3 py-2.5">
							<Legend
								item={active}
								displacement={displacement}
								fieldLimit={fieldLimit}
								zoneCount={zoneCount}
							/>
						</div>
					)}
				</>
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
							"min-h-11 flex-1 rounded-md px-1.5 py-2 text-xs font-semibold text-pretty transition-[color,background-color] focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1",
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

function RasterLegend({ layer }: { layer: Layer }) {
	const [lo, hi] = layer.valueRange;
	return (
		<figure className="mt-3" aria-label={`Leyenda de ${layer.name}`}>
			{layer.paint === "categorical" ? (
				<ul className="space-y-1 text-slate-200 text-xs">
					{layer.classes.map((c) => (
						<li key={c.value} className="flex items-center gap-2">
							<span
								className="inline-block size-3 rounded-sm"
								style={{ background: c.color }}
							/>
							{c.name}
						</li>
					))}
				</ul>
			) : (
				<Bar
					stops={gradient(PALETTES[layer.palette], layer.paint === "diverging")}
					left={`${lo.toFixed(1)} ${layer.units}`}
					right={`${hi.toFixed(1)} ${layer.units}`}
				/>
			)}
			<figcaption className="mt-2 space-y-1 text-slate-400 text-xs leading-relaxed">
				<p>{layer.description}</p>
				{layer.referenceDate && (
					<p>Dato de referencia: {layer.referenceDate.slice(0, 4)}.</p>
				)}
				<NoDataKey />
			</figcaption>
		</figure>
	);
}

export function Legend({
	item,
	displacement,
	fieldLimit,
	zoneCount,
}: {
	item: CatalogItem;
	displacement: Layer | null;
	fieldLimit: number;
	zoneCount: number;
}) {
	if (item.layer) return <RasterLegend layer={item.layer} />;
	const view = item.view;
	const layer = displacement;
	if (!layer) return null;
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
