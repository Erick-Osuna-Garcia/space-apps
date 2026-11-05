import { MapPinned, X } from "lucide-react";
import { Panel, PanelTitle } from "./Panel";

export interface InspectorRow {
	name: string;
	value: string;
}

interface InspectorProps {
	place: string | null;
	coords: string;
	rows: InspectorRow[];
	onClose: () => void;
}

/** Qué dice cada capa del punto tocado en el mapa. */
export function Inspector({ place, coords, rows, onClose }: InspectorProps) {
	return (
		<Panel className="w-full p-3 sm:w-72">
			<div className="flex items-center justify-between px-1">
				<PanelTitle className="flex items-center gap-1.5">
					<MapPinned className="size-3.5" aria-hidden /> Este punto
				</PanelTitle>
				<button
					type="button"
					onClick={onClose}
					aria-label="Cerrar inspector"
					className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
				>
					<X className="size-4" aria-hidden />
				</button>
			</div>
			{place && (
				<p className="mt-1 px-1 font-semibold text-slate-200 text-xs">
					{place}
				</p>
			)}
			<p className="px-1 text-[0.7rem] text-slate-500 tabular-nums">{coords}</p>
			<dl className="mt-2 space-y-1 px-1 text-xs">
				{rows.map((r) => (
					<div key={r.name} className="flex justify-between gap-3">
						<dt className="text-slate-400">{r.name}</dt>
						<dd className="text-right font-semibold text-slate-100 tabular-nums">
							{r.value}
						</dd>
					</div>
				))}
			</dl>
		</Panel>
	);
}
