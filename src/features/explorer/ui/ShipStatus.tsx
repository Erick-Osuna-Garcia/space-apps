import { cn } from "cn";
import { ArrowUp, CircleSlash, Gauge, Minus, TrendingDown } from "lucide-react";
import {
	compassHeading,
	nearestPoi,
	shipSpeedKmh,
	sizeComparison,
	TREND_LABELS,
	type TrendLevel,
	trendLevel,
} from "../lib/friendly";
import { linearRate, readSeries } from "../lib/probe";
import type { Layer, Region } from "../manifest";
import type { ProbeReading } from "../store";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

interface ShipStatusProps {
	region: Region;
	layer: Layer | null;
	cube: Int16Array | null;
	probe: ProbeReading | null;
	/** Altura del terreno bajo la nave, en metros. */
	groundM: number | null;
	dateIndex: number;
	compact: boolean;
	mode: "cumulative" | "velocity";
	/** Frase de la capa activa, cuando no es acumulado ni velocidad. */
	reading: string | null;
	loading: boolean;
	failed: boolean;
}

const TREND_STYLE: Record<
	TrendLevel,
	{ icon: typeof Minus; className: string }
> = {
	none: { icon: CircleSlash, className: "bg-slate-500/20 text-slate-300" },
	stable: { icon: Minus, className: "bg-emerald-400/15 text-emerald-200" },
	slow: { icon: TrendingDown, className: "bg-yellow-400/15 text-yellow-200" },
	moderate: {
		icon: TrendingDown,
		className: "bg-orange-400/20 text-orange-200",
	},
	fast: { icon: TrendingDown, className: "bg-red-500/25 text-red-200" },
	toward: { icon: ArrowUp, className: "bg-sky-400/20 text-sky-200" },
};

function TrendChip({ level }: { level: TrendLevel }) {
	const { icon: Icon, className } = TREND_STYLE[level];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-xs",
				className,
			)}
		>
			<Icon className="size-3.5" aria-hidden />
			{TREND_LABELS[level]}
		</span>
	);
}

function Readout({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-[0.65rem] text-slate-400 uppercase tracking-wider">
				{label}
			</dt>
			<dd className="font-bold text-sm text-white tabular-nums">{value}</dd>
		</div>
	);
}

/** Tablero de la nave: cómo vuela y qué lee su sensor de suelo. */
export function ShipStatus({
	region,
	layer,
	cube,
	probe,
	groundM,
	dateIndex,
	compact,
	mode,
	reading,
	loading,
	failed,
}: ShipStatusProps) {
	if (!probe) return null;
	const series =
		layer && cube
			? readSeries(cube, region, layer, probe.col, probe.row)
			: null;
	const value = series?.[dateIndex] ?? null;
	const rate = series && layer ? linearRate(series, layer.dates) : null;
	const main = mode === "velocity" ? rate : value;
	const unit = mode === "velocity" ? "cm/año" : "cm";
	const place = nearestPoi(region.pois, probe.col, probe.row, region.cellSizeM);
	const size = sizeComparison(main);
	const speed = shipSpeedKmh(probe.vx ?? 0, probe.vz ?? 0, region.cellSizeM);
	const flying = speed > 0;
	const sensor = loading
		? "Cargando…"
		: failed
			? "Sin datos"
			: reading && !series
				? reading
				: series && main === null
					? "Sin lectura"
					: main !== null
						? `${main > 0 ? "+" : ""}${main.toFixed(1)} ${unit}`
						: (reading ?? "—");

	if (compact) {
		return (
			<Panel className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5">
				<span
					aria-hidden
					className={cn(
						"inline-block size-2 shrink-0 rounded-full",
						flying ? "bg-emerald-400" : "bg-amber-300",
					)}
				/>
				<p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">
					{flying ? "En vuelo" : "Detenida"}
					{flying ? ` · ${speed.toLocaleString("es-MX")} km/h` : ""}
					{place ? ` · ${place.text}` : ""}
				</p>
				<p className="max-w-[46%] shrink-0 truncate text-right font-extrabold text-sm text-white tabular-nums">
					{sensor}
				</p>
				<InfoHint label="Sensor de suelo">
					<p>
						La nave lee lo que mide el radar justo debajo, en su línea de vista:
						negativo es que el suelo se alejó del satélite.
					</p>
					<p>
						Estable: menos de 1 cm/año. Lento: 1 a 3. Moderado: 3 a 8. Rápido:
						más de 8.
					</p>
					<p>Son niveles orientativos, no una evaluación de riesgo.</p>
				</InfoHint>
			</Panel>
		);
	}

	return (
		<Panel className={compact ? "px-3 py-2" : "w-64 p-3"}>
			<div className="flex items-center justify-between">
				<PanelTitle className="flex items-center gap-1.5">
					<Gauge className="size-3.5" aria-hidden /> Estado de la nave
				</PanelTitle>
				<InfoHint label="Sensor de suelo">
					<p>
						La nave lee lo que mide el radar justo debajo, en su línea de vista:
						negativo es que el suelo se alejó del satélite.
					</p>
					<p>
						Estable: menos de 1 cm/año. Lento: 1 a 3. Moderado: 3 a 8. Rápido:
						más de 8.
					</p>
					<p>Son niveles orientativos, no una evaluación de riesgo.</p>
				</InfoHint>
			</div>
			<p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
				<span
					className={cn(
						"inline-block size-2 rounded-full",
						flying ? "bg-emerald-400" : "bg-amber-300",
					)}
				/>
				{flying ? "En vuelo" : "Detenida"}
				{place && <span className="text-slate-400">· {place.text}</span>}
			</p>
			<dl className="mt-2 grid grid-cols-3 gap-2">
				<Readout
					label="Velocidad"
					value={flying ? `${speed.toLocaleString("es-MX")} km/h` : "0 km/h"}
				/>
				<Readout
					label="Rumbo"
					value={compassHeading(probe.vx ?? 0, probe.vz ?? 0) ?? "—"}
				/>
				<Readout
					label="Terreno"
					value={groundM === null ? "—" : `${Math.round(groundM)} m`}
				/>
			</dl>
			<div className="mt-2 border-white/10 border-t pt-2">
				<p className="text-[0.65rem] text-slate-400 uppercase tracking-wider">
					Sensor de suelo
				</p>
				{reading && (
					<p className="mt-0.5 font-bold text-cyan-200 text-sm">{reading}</p>
				)}
				{loading ? (
					<p className="mt-0.5 text-slate-300 text-sm">Cargando mediciones…</p>
				) : failed ? (
					<p className="mt-0.5 text-amber-200 text-sm">
						No se pudieron cargar las mediciones. Recarga la página.
					</p>
				) : series ? (
					main === null ? (
						<p className="mt-0.5 text-slate-300 text-sm">
							Sin lectura: el radar perdió coherencia aquí.
						</p>
					) : (
						<>
							<p className="mt-0.5 flex flex-wrap items-center gap-2">
								<span className="font-extrabold text-white text-xl tabular-nums">
									{main > 0 ? "+" : ""}
									{main.toFixed(1)}{" "}
									<span className="font-semibold text-slate-400 text-xs">
										{unit}
									</span>
								</span>
								<TrendChip level={trendLevel(rate)} />
							</p>
							{size && !compact && (
								<p className="text-slate-400 text-xs">
									{mode === "velocity" ? "Cada año" : "Tamaño del cambio"}:{" "}
									{size}
								</p>
							)}
						</>
					)
				) : reading ? null : (
					<p className="mt-0.5 text-slate-400 text-sm">Sin lectura aquí.</p>
				)}
			</div>
		</Panel>
	);
}
