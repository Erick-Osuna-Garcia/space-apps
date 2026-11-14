import { Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { Slider } from "#/components/ui/slider";
import { InfoHint } from "./InfoHint";
import { Panel } from "./Panel";

const STEP_MS = 3000;

const fmtDate = (iso: string) =>
	new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

interface TimelineProps {
	dates: string[];
	index: number;
	playing: boolean;
	onSelect: (index: number) => void;
	onPlaying: (playing: boolean) => void;
	onAdvance: () => void;
	/** La reproducción espera a que la capa esté cargada. */
	ready: boolean;
	/** Mensaje opcional bajo el slider (p. ej. en modo velocidad). */
	note?: string;
}

export function Timeline({
	dates,
	index,
	playing,
	onSelect,
	onPlaying,
	onAdvance,
	ready,
	note,
}: TimelineProps) {
	useEffect(() => {
		if (!playing || !ready) return;
		const id = window.setInterval(onAdvance, STEP_MS);
		return () => window.clearInterval(id);
	}, [playing, ready, onAdvance]);

	return (
		<Panel className="flex w-full items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
			<button
				type="button"
				onClick={() => onPlaying(!playing)}
				aria-label={playing ? "Pausar" : "Reproducir"}
				className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-950 transition-[background-color] hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
			>
				{playing ? (
					<Pause className="size-4" aria-hidden />
				) : (
					<Play className="size-4" aria-hidden />
				)}
			</button>
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs text-slate-400 tabular-nums">
						Fecha {index + 1} de {dates.length}
					</span>
					<InfoHint label="Línea de tiempo">
						<p>
							Cada punto es una pasada del satélite ({dates.length} fechas).
							Mueve el control o presiona play para ver cómo cambia el suelo.
						</p>
					</InfoHint>
				</div>
				<Slider
					className="mt-2"
					aria-label="Fecha"
					min={0}
					max={Math.max(0, dates.length - 1)}
					step={1}
					value={[index]}
					onValueChange={([v]) => onSelect(v)}
				/>
				<div className="mt-1 flex justify-between text-[0.65rem] text-slate-500 tabular-nums">
					<span>{fmtDate(dates[0])}</span>
					<span>{fmtDate(dates[dates.length - 1])}</span>
				</div>
				{note && <p className="mt-1 text-[0.7rem] text-cyan-200/80">{note}</p>}
			</div>
		</Panel>
	);
}
