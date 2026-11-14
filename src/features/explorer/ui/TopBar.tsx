import {
	Boxes,
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
	onOpenModels: () => void;
	/** Solo el Valle de Mexicali ofrece la lectura agrícola. */
	onOpenAgriculture?: () => void;
	agricultureOpen?: boolean;
	eventsOpen?: boolean;
	modelsOpen?: boolean;
	contextOpen?: boolean;
	creditsOpen?: boolean;
	/** Aviso de origen de los datos, bajo el nombre de la región. */
	notice?: React.ReactNode;
	/** En teléfono los botones viven en la barra inferior. */
	compact?: boolean;
}

export function TopBar({
	region,
	exaggeration,
	onOpenContext,
	onOpenCredits,
	onOpenSettings,
	onOpenEvents,
	onOpenModels,
	onOpenAgriculture,
	agricultureOpen = false,
	eventsOpen = false,
	modelsOpen = false,
	contextOpen = false,
	creditsOpen = false,
	notice,
	compact = false,
}: TopBarProps) {
	if (compact) {
		return (
			<Panel className="min-w-0 px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<Satellite className="size-4 shrink-0 text-cyan-300" aria-hidden />
					<div className="min-w-0 flex-1">
						<p className="truncate text-[0.65rem] font-semibold text-cyan-300">
							<span translate="no">NISAR</span>
						</p>
						<h1 className="truncate text-base font-extrabold text-pretty text-white">
							{region.name}
						</h1>
					</div>
					<p className="shrink-0 text-right text-[0.65rem] text-slate-400 tabular-nums">
						<span className="block font-bold text-slate-200">
							×{exaggeration}
						</span>
						{Math.round(region.cellSizeM)} m
					</p>
				</div>
				{notice}
			</Panel>
		);
	}

	return (
		<div className="flex items-start justify-between gap-3">
			<Panel className="min-w-0 px-4 py-3">
				<div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-300">
					<Satellite className="size-3.5 shrink-0" aria-hidden />
					<span className="truncate">Dancing with the SARs · NISAR</span>
				</div>
				<h1 className="mt-1 text-lg font-extrabold text-pretty leading-tight text-white sm:text-xl">
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
			<div className="pointer-events-auto flex max-w-[42rem] flex-wrap justify-end gap-2">
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
				<HudButton onClick={onOpenModels} label="Modelos" pressed={modelsOpen}>
					<Boxes className="size-4" aria-hidden />
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
			className={`flex h-11 min-w-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-lg backdrop-blur-md transition-[color,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
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
