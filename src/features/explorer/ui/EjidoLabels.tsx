import { ejidoKey, type Ejido } from "../lib/ejidos";

type EjidoLabelsProps = {
	ejidos: Ejido[];
	labels: React.RefObject<Map<string, HTMLElement>>;
	onSelect: (ejido: Ejido) => void;
};

/** Nombres de ejido sobre el mapa; `EjidoMarkers` actualiza su posición cada cuadro. */
export const EjidoLabels = ({ ejidos, labels, onSelect }: EjidoLabelsProps) => {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			{ejidos.map((ejido, index) => (
				<button
					key={ejidoKey(ejido, index)}
					type="button"
					ref={(el) => {
						const id = ejidoKey(ejido, index);
						if (el) labels.current?.set(id, el);
						else labels.current?.delete(id);
					}}
					onClick={() => onSelect(ejido)}
					style={{ visibility: "hidden" }}
					className="pointer-events-auto absolute top-0 left-0 max-w-[10rem] truncate rounded-sm border border-amber-300/50 bg-slate-950/75 px-1.5 py-0.5 text-left font-semibold text-[0.65rem] text-amber-100 shadow-sm backdrop-blur-sm hover:bg-amber-400 hover:text-slate-950"
				>
					{ejido.name}
				</button>
			))}
		</div>
	);
};
