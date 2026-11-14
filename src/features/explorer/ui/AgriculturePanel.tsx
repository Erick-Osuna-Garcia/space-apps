import { Sprout, X } from "lucide-react";
import {
	AGRI_COPY,
	type AgriZone,
	type ChangeWord,
	type DisturbWord,
	listHelp,
	type VegWord,
} from "../lib/agriculture";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

export interface CompareColumn {
	id: number;
	areaKm2: number;
	values: Array<number | null>;
}

interface AgriculturePanelProps {
	missingCover: boolean;
	loading: boolean;
	listed: AgriZone[];
	omitted: boolean;
	selected: AgriZone | null;
	rejected: boolean;
	moisture: number | null;
	dates: string[];
	activeIndex: number;
	selectedSeries: Array<number | null>;
	columns: CompareColumn[];
	vegetation: VegWord | null;
	change: ChangeWord | null;
	disturbance: DisturbWord | null;
	water: string[];
	onSelect: (id: number) => void;
	onCompare: (id: number) => void;
	onRemove: (id: number) => void;
	onClose: () => void;
}

const fmt = (value: number | null) =>
	value === null ? AGRI_COPY.noReading : value.toFixed(3);

export function AgriculturePanel(props: AgriculturePanelProps) {
	return (
		<Panel className="flex max-h-[70dvh] min-h-0 w-full flex-col overflow-hidden p-3 sm:w-80">
			<div className="flex shrink-0 items-center justify-between gap-2 px-1">
				<PanelTitle className="flex items-center gap-1.5">
					<Sprout className="size-3.5" aria-hidden />
					Cultivos
				</PanelTitle>
				<div className="flex items-center">
					<InfoHint label="Zonas agrícolas">
						<p>{listHelp(props.omitted)}</p>
						<p>{AGRI_COPY.coverage}</p>
						<p>{AGRI_COPY.moisture}</p>
						<p>{AGRI_COPY.noAdvice}</p>
						<p>{AGRI_COPY.noCause}</p>
					</InfoHint>
					<button
						type="button"
						onClick={props.onClose}
						aria-label="Cerrar cultivos"
						className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
					>
						<X className="size-4" aria-hidden />
					</button>
				</div>
			</div>
			{props.missingCover ? (
				<p className="mt-2 px-1 text-xs text-slate-300">
					{AGRI_COPY.missingCover}
				</p>
			) : props.loading ? (
				<p className="mt-2 px-1 text-xs text-slate-400">Cargando cobertura…</p>
			) : (
				<ul className="scroll-thin mt-2 max-h-36 shrink-0 space-y-1 overflow-y-auto px-1">
					{props.listed.map((zone) => (
						<li key={zone.id} className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => props.onSelect(zone.id)}
								className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-left text-xs ${
									props.selected?.id === zone.id
										? "zone-selected border-emerald-400"
										: "border-transparent text-slate-200 hover:bg-white/10"
								}`}
							>
								Zona {zone.id + 1}
								<span
									className={`ml-2 tabular-nums ${
										props.selected?.id === zone.id
											? "text-emerald-50"
											: "text-slate-400"
									}`}
								>
									{zone.areaKm2.toFixed(1)} km²
								</span>
							</button>
							<button
								type="button"
								onClick={() => props.onCompare(zone.id)}
								className="rounded-lg px-2 py-1 text-[0.7rem] text-slate-400 hover:bg-white/10 hover:text-white"
							>
								Comparar
							</button>
						</li>
					))}
				</ul>
			)}
			{!props.missingCover && !props.loading && (
				<p className="mt-2 shrink-0 px-1 text-[0.65rem] text-slate-400">
					En el mapa, el verde es cultivo. La zona elegida pasa de un verde
					claro a uno fuerte y su borde parpadea. Las
					plantas son variantes del valle (trigo, algodón, alfalfa, hortalizas y
					frutales) y no identifican el cultivo de cada parcela.
				</p>
			)}
			{props.rejected && (
				<p className="mt-2 px-1 text-xs text-amber-200">
					{AGRI_COPY.compareLimit}
				</p>
			)}
			{props.selected && (
				<div className="scroll-thin mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 text-xs">
					<p className="font-semibold text-slate-100">
						Zona {props.selected.id + 1} · humedad{" "}
						<span className="tabular-nums">{fmt(props.moisture)}</span>
						{props.moisture !== null && " m³/m³"}
					</p>
					<p className="text-slate-400">{AGRI_COPY.moisture}</p>
					<ul className="space-y-0.5">
						{props.dates.map((date, index) => (
							<li
								key={date}
								className={`flex justify-between rounded px-1 tabular-nums ${
									index === props.activeIndex
										? "bg-cyan-300/15 text-cyan-100"
										: "text-slate-400"
								}`}
							>
								<span>{date}</span>
								<span>{fmt(props.selectedSeries[index] ?? null)}</span>
							</li>
						))}
					</ul>
					{props.vegetation && <p>Vegetación: {props.vegetation}</p>}
					{props.change && <p>Superficie: {props.change}</p>}
					{props.disturbance && <p>Disturbio: {props.disturbance}</p>}
					{props.water.map((line) => (
						<p key={line} className="text-slate-300">
							{line}
						</p>
					))}
					<p className="text-slate-500">{AGRI_COPY.coverage}</p>
					<p className="text-slate-500">{AGRI_COPY.noAdvice}</p>
					<p className="text-slate-500">{AGRI_COPY.noCause}</p>
					{props.columns.length > 1 && (
						<div>
							<p className="mb-1 font-semibold text-slate-200">Comparación</p>
							<ul className="space-y-1">
								{props.columns.map((column) => (
									<li
										key={column.id}
										className="flex items-center justify-between gap-2"
									>
										<span>
											Zona {column.id + 1}
											<span className="ml-1 text-slate-500">
												{fmt(column.values[props.activeIndex] ?? null)}
											</span>
										</span>
										{column.id !== props.selected?.id && (
											<button
												type="button"
												onClick={() => props.onRemove(column.id)}
												className="text-slate-500 hover:text-white"
											>
												Quitar
											</button>
										)}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</Panel>
	);
}
