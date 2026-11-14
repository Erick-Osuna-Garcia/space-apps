import { Activity, Droplets, Layers, Radar, TrendingDown } from "lucide-react";
import { useState } from "react";
import type { ImpactEvent } from "../data/queries";
import { Segmented } from "./LayerPanel";

const GROUPS: Array<{
	type: string;
	label: string;
	icon: typeof Activity;
}> = [
	{ type: "subsidence", label: "Hundimiento por zona", icon: TrendingDown },
	{ type: "rate-change", label: "Cambios de ritmo", icon: Activity },
	{ type: "water", label: "Agua nueva", icon: Droplets },
	{ type: "disturbance", label: "Cambios bruscos en el terreno", icon: Radar },
	{ type: "change", label: "Cambios en la superficie", icon: Layers },
];

const SHORT: Record<string, string> = {
	subsidence: "Hundimiento",
	"rate-change": "Ritmo",
	water: "Agua",
	disturbance: "Bruscos",
	change: "Superficie",
};

const shortLabel = (type: string) => SHORT[type] ?? type;

const fmt = (iso: string) =>
	new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

interface EventsListProps {
	events: ImpactEvent[];
	onSelect: (event: ImpactEvent) => void;
}

const largest = (items: ImpactEvent[]) =>
	items.reduce((best, event) =>
		event.areaKm2 > best.areaKm2 ? event : best,
	);

/** Lista de cambios detectados, por tipo; tocar uno lleva a la nave y a su fecha. */
export function EventsList({ events, onSelect }: EventsListProps) {
	const [picked, setPicked] = useState<string>("all");
	if (events.length === 0) {
		return <p>No se detectaron eventos en esta región.</p>;
	}
	const available = GROUPS.filter((group) =>
		events.some((event) => event.type === group.type),
	);
	const active = available.some((group) => group.type === picked)
		? picked
		: "all";
	const shown =
		active === "all" ? events : events.filter((event) => event.type === active);
	const activeGroup = available.find((group) => group.type === active);
	return (
		<div className="leading-snug">
			<p className="text-pretty text-slate-400 text-xs">
				Cambios medidos, con fecha y lugar. No se conoce su causa ni confirman
				daños. Toca uno para ir ahí.
			</p>
			<Segmented
				label="Filtrar"
				value={active}
				onChange={setPicked}
				columns={3}
				options={[
					{ value: "all", label: `Todos ${events.length}` },
					...available.map((group) => ({
						value: group.type,
						label: `${shortLabel(group.type)} ${events.filter((event) => event.type === group.type).length}`,
					})),
				]}
			/>
			<button
				type="button"
				onClick={() => onSelect(largest(shown))}
				className="mt-2 flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-200 text-sm transition-[background-color] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
			>
				{!activeGroup || activeGroup.type === "subsidence"
					? "Ir a la zona mayor"
					: "Ir al evento mayor"}
				<span className="font-normal text-slate-400 text-xs tabular-nums">
					{shown.length} de {events.length}
				</span>
			</button>
			<div className="mt-3 space-y-3">
			{GROUPS.map(({ type, label, icon: Icon }) => {
				const items = shown.filter((e) => e.type === type);
				if (items.length === 0) return null;
				return (
					<section key={type}>
						<h3 className="mb-1.5 flex items-center gap-1.5 font-bold text-[0.68rem] text-slate-400 uppercase tracking-[0.14em]">
							<Icon className="size-3.5" aria-hidden /> {label}
						</h3>
						<ul className="space-y-0.5">
							{items.map((e) => (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => onSelect(e)}
										className="min-h-11 w-full rounded-lg px-2.5 py-1.5 text-left transition-[background-color] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300"
									>
										<span className="block font-semibold text-sm text-white">
											{e.title}
										</span>
										<span className="block text-slate-300 text-xs">
											{e.place}
										</span>
										<span className="block text-slate-400 text-xs">
											{e.dateEnd
												? `${fmt(e.date)} a ${fmt(e.dateEnd)}`
												: fmt(e.date)}{" "}
											· {e.detail}
										</span>
									</button>
								</li>
							))}
						</ul>
					</section>
				);
			})}
			</div>
		</div>
	);
}
