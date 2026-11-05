import { BAND_COLORS, BAND_NAMES, type Zone } from "../lib/impact";

interface ZoneLabelsProps {
	zones: Zone[];
	labels: React.RefObject<Map<string, HTMLElement>>;
	onSelect: (zone: Zone) => void;
}

const velocityText = (v: number | null) =>
	v === null
		? "velocidad no disponible"
		: `${v > 0 ? "+" : ""}${v.toFixed(1)} cm/año`;

/** Etiquetas de las zonas principales; `ZoneMarkers` actualiza su posición cada cuadro. */
export function ZoneLabels({ zones, labels, onSelect }: ZoneLabelsProps) {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			{zones.map((zone, rank) => (
				<button
					// biome-ignore lint/suspicious/noArrayIndexKey: la posición en el ranking es la identidad estable
					key={rank}
					type="button"
					ref={(el) => {
						if (el) labels.current?.set(String(rank), el);
						else labels.current?.delete(String(rank));
					}}
					onClick={() => onSelect(zone)}
					style={{ visibility: "hidden", borderColor: BAND_COLORS[zone.band] }}
					className="pointer-events-auto absolute top-0 left-0 whitespace-nowrap rounded-full border-2 bg-slate-950/85 px-2.5 py-1 text-left font-semibold text-white text-xs shadow-lg transition-colors hover:bg-slate-800"
				>
					{BAND_NAMES[zone.band]}
					<span className="ml-1.5 text-slate-300 tabular-nums">
						{velocityText(zone.meanVelocity)}
					</span>
				</button>
			))}
		</div>
	);
}
