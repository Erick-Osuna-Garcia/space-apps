import { Activity, Droplets, Layers, Radar, TrendingDown } from "lucide-react";
import type { ImpactEvent } from "../data/queries";

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

/** Lista de cambios detectados, por tipo; tocar uno lleva a la nave y a su fecha. */
export function EventsList({ events, onSelect }: EventsListProps) {
	if (events.length === 0) {
		return <p>No se detectaron eventos en esta región.</p>;
	}
	return (
		<div className="space-y-4">
			<p className="text-slate-400 text-xs">
				Cambios medidos, con fecha y lugar. No se conoce su causa ni confirman
				daños. Toca uno para ir ahí.
			</p>
			{GROUPS.map(({ type, label, icon: Icon }) => {
				const items = events.filter((e) => e.type === type);
				if (items.length === 0) return null;
				return (
					<section key={type}>
						<h3 className="mb-1 flex items-center gap-1.5 font-bold text-[0.68rem] text-slate-400 uppercase tracking-[0.14em]">
							<Icon className="size-3.5" aria-hidden /> {label}
						</h3>
						<ul className="space-y-1">
							{items.map((e) => (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => onSelect(e)}
										className="w-full rounded-lg bg-white/5 px-2.5 py-2 text-left transition hover:bg-white/10"
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
	);
}
