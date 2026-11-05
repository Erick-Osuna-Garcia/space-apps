import { cn } from "cn";
import {
	ArrowUp,
	CircleSlash,
	Crosshair,
	Minus,
	TrendingDown,
} from "lucide-react";
import {
	nearestPoi,
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

interface ProbeProps {
	region: Region;
	layer: Layer | null;
	cube: Int16Array | null;
	probe: ProbeReading | null;
	dateIndex: number;
	compact: boolean;
	mode: "cumulative" | "velocity";
	/** Frase de la vista activa (Zonas, Diferencial, Aceleración). */
	reading: string | null;
	loading: boolean;
	failed: boolean;
}

const fmtCoord = (v: number, pos: string, neg: string) =>
	`${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

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
				"mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-xs",
				className,
			)}
		>
			<Icon className="size-3.5" aria-hidden />
			{TREND_LABELS[level]}
		</span>
	);
}

export function Probe({
	region,
	layer,
	cube,
	probe,
	dateIndex,
	compact,
	mode,
	reading,
	loading,
	failed,
}: ProbeProps) {
	if (!probe) return null;
	const series =
		layer && cube
			? readSeries(cube, region, layer, probe.col, probe.row)
			: null;
	const value = series?.[dateIndex] ?? null;
	const rate = series && layer ? linearRate(series, layer.dates) : null;
	const sign = (v: number) => (v > 0 ? "+" : "");
	// En modo velocidad el valor principal es la tendencia; el acumulado pasa a segundo plano.
	const main =
		mode === "velocity"
			? rate === null
				? null
				: { v: rate, unit: "cm/año" }
			: value === null
				? null
				: { v: value, unit: "cm" };
	const secondary =
		mode === "velocity"
			? value === null
				? null
				: `Acumulado ${sign(value)}${value.toFixed(1)} cm a la fecha`
			: rate === null
				? null
				: `Tendencia ${sign(rate)}${rate.toFixed(1)} cm/año`;
	const place = nearestPoi(region.pois, probe.col, probe.row, region.cellSizeM);
	const size = sizeComparison(main?.v ?? null);
	const sizeText = size
		? `${mode === "velocity" ? "Cada año" : "Tamaño del cambio"}: ${size}`
		: null;

	return (
		<Panel className={compact ? "px-3 py-2" : "w-64 p-3"}>
			<div className="flex items-center justify-between">
				<PanelTitle className="flex items-center gap-1.5">
					<Crosshair className="size-3.5" aria-hidden /> Bajo tu nave
				</PanelTitle>
				<InfoHint label="Bajo tu nave">
					<p>
						Lo que mide el radar justo debajo de la nave, en su línea de vista:
						negativo es que el suelo se alejó del satélite.
					</p>
					<p>
						Estable: menos de 1 cm/año. Lento: 1 a 3. Moderado: 3 a 8. Rápido:
						más de 8.
					</p>
					<p>Son niveles orientativos, no una evaluación de riesgo.</p>
				</InfoHint>
			</div>
			{place && (
				<p className="mt-1 font-semibold text-slate-200 text-xs">
					{place.text}
				</p>
			)}
			<p className="text-[0.7rem] text-slate-500 tabular-nums">
				{fmtCoord(probe.lat, "N", "S")}, {fmtCoord(probe.lon, "E", "O")}
			</p>
			{reading && (
				<p className="mt-1.5 font-bold text-cyan-200 text-sm">{reading}</p>
			)}
			{loading ? (
				<p className="mt-1.5 text-slate-300 text-sm">Cargando mediciones…</p>
			) : failed ? (
				<p className="mt-1.5 text-amber-200 text-sm">
					No se pudieron cargar las mediciones. Recarga la página.
				</p>
			) : series ? (
				main === null ? (
					<>
						<TrendChip level="none" />
						<p className="mt-1 text-xs text-slate-400">
							Sin dato: el radar perdió coherencia en este punto.
						</p>
					</>
				) : (
					<>
						<TrendChip level={trendLevel(rate)} />
						<p className="mt-1 text-2xl font-extrabold tabular-nums text-white">
							{sign(main.v)}
							{main.v.toFixed(1)}{" "}
							<span className="text-sm font-semibold text-slate-400">
								{main.unit}
							</span>
						</p>
						{secondary && (
							<p className="text-xs text-slate-400 tabular-nums">{secondary}</p>
						)}
						{sizeText && <p className="text-xs text-slate-400">{sizeText}</p>}
						{!compact && (
							<Sparkline series={series} index={dateIndex} layer={layer} />
						)}
					</>
				)
			) : reading ? null : (
				<p className="mt-1.5 text-sm text-slate-400">
					Aún no hay mediciones para esta capa aquí.
				</p>
			)}
		</Panel>
	);
}

function Sparkline({
	series,
	index,
	layer,
}: {
	series: Array<number | null>;
	index: number;
	layer: Layer | null;
}) {
	const w = 232;
	const h = 54;
	const vals = series.filter((v): v is number => v !== null);
	const lo = Math.min(0, ...vals, layer?.valueRange[0] ?? 0);
	const hi = Math.max(0, ...vals);
	const span = hi - lo || 1;
	const x = (i: number) =>
		series.length > 1 ? (i / (series.length - 1)) * w : w / 2;
	const y = (v: number) => 4 + ((hi - v) / span) * (h - 8);
	const pts = series
		.map((v, i) =>
			v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`,
		)
		.filter(Boolean)
		.join(" ");
	const cur = series[index];
	return (
		<svg
			viewBox={`0 0 ${w} ${h}`}
			className="mt-2 h-14 w-full"
			role="img"
			aria-label="Serie de tiempo del punto bajo la nave"
		>
			<line
				x1={0}
				x2={w}
				y1={y(0)}
				y2={y(0)}
				stroke="rgb(148 163 184 / 0.35)"
				strokeDasharray="3 3"
			/>
			<polyline
				points={pts}
				fill="none"
				stroke="rgb(253 186 116)"
				strokeWidth={2}
				strokeLinejoin="round"
			/>
			{cur !== null && cur !== undefined && (
				<circle
					cx={x(index)}
					cy={y(cur)}
					r={3.5}
					fill="white"
					stroke="rgb(253 186 116)"
					strokeWidth={2}
				/>
			)}
		</svg>
	);
}
