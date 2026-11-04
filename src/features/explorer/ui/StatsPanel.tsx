import { BarChart3, Plane } from "lucide-react";
import type { DateStats } from "../lib/stats";
import { STATS_THRESHOLDS, type StatsThreshold } from "../store";
import { Segmented } from "./LayerPanel";
import { Panel, PanelTitle } from "./Panel";

interface StatsPanelProps {
	stats: DateStats;
	date: string;
	threshold: StatsThreshold;
	onThreshold: (t: StatsThreshold) => void;
	onFlyToMax: () => void;
	compact: boolean;
}

const num = (v: number, digits = 1) =>
	v.toLocaleString("es-MX", {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});

export function StatsPanel({
	stats,
	date,
	threshold,
	onThreshold,
	onFlyToMax,
	compact,
}: StatsPanelProps) {
	return (
		<Panel className={compact ? "w-full p-3" : "w-64 p-3"}>
			<PanelTitle className="flex items-center gap-1.5 px-1">
				<BarChart3 className="size-3.5" aria-hidden /> Estadísticas
			</PanelTitle>
			<p className="mt-0.5 px-1 text-[0.7rem] text-slate-500 tabular-nums">
				a la fecha {date}
			</p>
			<dl className="mt-2 space-y-2.5 px-1">
				<div>
					<dt className="text-xs text-slate-400">Hundimiento máximo</dt>
					<dd className="flex items-center justify-between gap-2">
						<span className="text-lg font-extrabold text-white tabular-nums">
							{stats.maxSubsidence === null
								? "—"
								: `${num(stats.maxSubsidence)} cm`}
						</span>
						{stats.maxCell && (
							<button
								type="button"
								onClick={onFlyToMax}
								className="flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-400 hover:text-slate-950"
							>
								<Plane className="size-3" aria-hidden /> Volar al punto
							</button>
						)}
					</dd>
				</div>
				<div>
					<dt className="text-xs text-slate-400">
						Área hundida más de {threshold} cm
					</dt>
					<dd className="text-lg font-extrabold text-white tabular-nums">
						{num(stats.areaKm2)} km²
					</dd>
				</div>
				<div>
					<dt className="text-xs text-slate-400">
						Velocidad media en esa área
					</dt>
					<dd className="text-lg font-extrabold text-white tabular-nums">
						{stats.meanVelocity === null
							? "no disponible"
							: `${num(stats.meanVelocity)} cm/año`}
					</dd>
				</div>
			</dl>
			<Segmented
				label="Umbral de hundimiento"
				value={threshold}
				onChange={onThreshold}
				options={STATS_THRESHOLDS.map((t) => ({
					value: t,
					label: `> ${t} cm`,
				}))}
			/>
		</Panel>
	);
}
