import { BookOpen, Info, Satellite } from "lucide-react";
import type { Region } from "../manifest";
import { Panel } from "./Panel";

interface TopBarProps {
	region: Region;
	exaggeration: number;
	onOpenContext: () => void;
	onOpenCredits: () => void;
}

export function TopBar({
	region,
	exaggeration,
	onOpenContext,
	onOpenCredits,
}: TopBarProps) {
	return (
		<div className="flex items-start justify-between gap-3">
			<Panel className="px-4 py-3">
				<div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-300">
					<Satellite className="size-3.5" aria-hidden />
					Dancing with the SARs · NISAR
				</div>
				<h1 className="mt-1 text-lg font-extrabold leading-tight text-white sm:text-xl">
					{region.name}
				</h1>
				<p className="mt-1 text-xs text-slate-400">
					Relieve exagerado{" "}
					<span className="font-bold text-slate-200">×{exaggeration}</span>
					<span className="mx-1.5 text-slate-600">·</span>
					celda {Math.round(region.cellSizeM)} m
				</p>
			</Panel>
			<div className="pointer-events-auto flex gap-2">
				<HudButton onClick={onOpenContext} label="Contexto">
					<BookOpen className="size-4" aria-hidden />
				</HudButton>
				<HudButton onClick={onOpenCredits} label="Créditos">
					<Info className="size-4" aria-hidden />
				</HudButton>
			</div>
		</div>
	);
}

function HudButton({
	label,
	children,
	...props
}: React.ComponentProps<"button"> & { label: string }) {
	return (
		<button
			type="button"
			className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/75 px-3 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur-md transition hover:border-cyan-300/50 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300"
			{...props}
		>
			{children}
			<span className="hidden sm:inline">{label}</span>
			<span className="sr-only sm:hidden">{label}</span>
		</button>
	);
}
