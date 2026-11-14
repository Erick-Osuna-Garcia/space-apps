import {
	BookOpen,
	Info,
	ListChecks,
	Satellite,
	Settings,
	Sprout,
} from "lucide-react";
import type { Region } from "../manifest";
import { Panel } from "./Panel";

interface TopBarProps {
	region: Region;
	exaggeration: number;
	onOpenContext: () => void;
	onOpenCredits: () => void;
	onOpenSettings: () => void;
	onOpenEvents: () => void;
	/** Solo el Valle de Mexicali ofrece la lectura agrícola. */
	onOpenAgriculture?: () => void;
	agricultureOpen?: boolean;
	eventsOpen?: boolean;
	contextOpen?: boolean;
	creditsOpen?: boolean;
	/** Aviso de origen de los datos, bajo el nombre de la región. */
	notice?: React.ReactNode;
}

export function TopBar({
	region,
	exaggeration,
	onOpenContext,
	onOpenCredits,
	onOpenSettings,
	onOpenEvents,
	onOpenAgriculture,
	agricultureOpen = false,
	eventsOpen = false,
	contextOpen = false,
	creditsOpen = false,
	notice,
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
				{notice}
			</Panel>
			<div className="pointer-events-auto flex gap-2">
				{onOpenAgriculture && (
					<HudButton
						onClick={onOpenAgriculture}
						label="Cultivos"
						pressed={agricultureOpen}
					>
						<Sprout className="size-4" aria-hidden />
					</HudButton>
				)}
				<HudButton onClick={onOpenEvents} label="Eventos" pressed={eventsOpen}>
					<ListChecks className="size-4" aria-hidden />
				</HudButton>
				<HudButton onClick={onOpenSettings} label="Ajustes">
					<Settings className="size-4" aria-hidden />
				</HudButton>
				<HudButton
					onClick={onOpenContext}
					label="Contexto"
					pressed={contextOpen}
				>
					<BookOpen className="size-4" aria-hidden />
				</HudButton>
				<HudButton
					onClick={onOpenCredits}
					label="Créditos"
					pressed={creditsOpen}
				>
					<Info className="size-4" aria-hidden />
				</HudButton>
			</div>
		</div>
	);
}

function HudButton({
	label,
	pressed = false,
	children,
	...props
}: React.ComponentProps<"button"> & { label: string; pressed?: boolean }) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-lg backdrop-blur-md transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${
				pressed
					? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
					: "border-white/10 bg-slate-950/75 text-slate-100 hover:border-cyan-300/50 hover:text-cyan-200"
			}`}
			{...props}
		>
			{children}
			<span className="hidden sm:inline">{label}</span>
			<span className="sr-only sm:hidden">{label}</span>
		</button>
	);
}
