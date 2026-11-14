import type { Poi } from "../manifest";

interface PoiLabelsProps {
	pois: Poi[];
	labels: React.RefObject<Map<string, HTMLElement>>;
	onSelect: (poi: Poi) => void;
	/** Destino elegido. La ciudad solo parpadea mientras es este punto. */
	selectedId?: string | null;
}

/** Etiquetas de los POIs sobre el canvas; `PoiMarkers` actualiza su posición cada cuadro. */
export function PoiLabels({
	pois,
	labels,
	onSelect,
	selectedId = null,
}: PoiLabelsProps) {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			{pois.map((poi) => (
				<button
					key={poi.id}
					type="button"
					ref={(el) => {
						if (el) labels.current?.set(poi.id, el);
						else labels.current?.delete(poi.id);
					}}
					onClick={() => onSelect(poi)}
					style={{ visibility: "hidden" }}
					className={`pointer-events-auto absolute top-0 left-0 whitespace-nowrap rounded-full border border-amber-300/40 bg-slate-950/80 px-2.5 py-1 font-semibold text-amber-100 text-xs shadow-lg backdrop-blur transition-colors hover:bg-amber-400 hover:text-slate-950 ${
						poi.id === "mexicali-centro"
							? `city-label${selectedId === poi.id ? " city-label-live" : ""}`
							: ""
					}`}
				>
					{poi.name}
				</button>
			))}
		</div>
	);
}
