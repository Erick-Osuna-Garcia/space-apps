import { Crosshair } from "lucide-react";
import { linearRate, readSeries } from "../lib/probe";
import type { Layer, Region } from "../manifest";
import type { ProbeReading } from "../store";
import { Panel, PanelTitle } from "./Panel";

interface ProbeProps {
	region: Region;
	layer: Layer | null;
	cube: Int16Array | null;
	probe: ProbeReading | null;
	dateIndex: number;
	compact: boolean;
	mode: "cumulative" | "velocity";
}

const fmtCoord = (v: number, pos: string, neg: string) =>
	`${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

export function Probe({
	region,
	layer,
	cube,
	probe,
	dateIndex,
	compact,
	mode,
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
				: { v: rate, unit: "cm/año LOS" }
			: value === null
				? null
				: { v: value, unit: "cm LOS" };
	const secondary =
		mode === "velocity"
			? value === null
				? null
				: `Acumulado ${sign(value)}${value.toFixed(1)} cm a la fecha`
			: rate === null
				? null
				: `Tendencia ${sign(rate)}${rate.toFixed(1)} cm/año`;

	return (
		<Panel className={compact ? "px-3 py-2" : "w-64 p-3"}>
			<PanelTitle className="flex items-center gap-1.5">
				<Crosshair className="size-3.5" aria-hidden /> Sonda
			</PanelTitle>
			<p className="mt-1 text-xs text-slate-400 tabular-nums">
				{fmtCoord(probe.lat, "N", "S")}, {fmtCoord(probe.lon, "E", "O")}
			</p>
			{series ? (
				main === null ? (
					<p className="mt-1.5 text-sm font-semibold text-slate-300">
						Sin dato (baja coherencia)
					</p>
				) : (
					<>
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
						{!compact && (
							<Sparkline series={series} index={dateIndex} layer={layer} />
						)}
					</>
				)
			) : (
				<p className="mt-1.5 text-sm text-slate-400">
					Sin capa activa en esta región.
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
