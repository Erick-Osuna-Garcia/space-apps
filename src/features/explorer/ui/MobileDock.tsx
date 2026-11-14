import {
	BookOpen,
	Boxes,
	Info,
	Layers,
	ListChecks,
	Settings,
	Sprout,
} from "lucide-react";

const ICONS = {
	crops: Sprout,
	events: ListChecks,
	layers: Layers,
	models: Boxes,
	context: BookOpen,
	credits: Info,
	settings: Settings,
} as const;

export interface DockItem {
	id: string;
	label: string;
	icon: keyof typeof ICONS;
	pressed?: boolean;
	onClick: () => void;
}

/** Barra inferior del teléfono: un destino por herramienta, tamaño de pulgar. */
export function MobileDock({ items }: { items: DockItem[] }) {
	return (
		<nav
			aria-label="Herramientas"
			className="pointer-events-auto -mx-1 flex touch-manipulation gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{items.map((item) => {
				const Icon = ICONS[item.icon];
				return (
					<button
						key={item.id}
						type="button"
						aria-pressed={item.pressed}
						onClick={item.onClick}
						className={`flex min-h-11 min-w-16 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-[0.65rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
							item.pressed
								? "border-cyan-300 bg-cyan-400/20 text-cyan-100"
								: "border-white/15 bg-slate-950/80 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100"
						}`}
					>
						<Icon className="size-4" aria-hidden />
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}
