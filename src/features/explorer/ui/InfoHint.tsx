import { CircleHelp } from "lucide-react";
import { Popover } from "radix-ui";

/** Ayuda corta de un panel: funciona con ratón, teclado y táctil, y no bloquea el pilotaje. */
export function InfoHint({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Popover.Root>
			<Popover.Trigger
				aria-label={`Ayuda: ${label}`}
				className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-[color,background-color] hover:bg-white/10 hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300 sm:size-6"
			>
				<CircleHelp className="size-4" aria-hidden />
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					side="top"
					align="center"
					sideOffset={8}
					collisionPadding={12}
					className="z-50 max-w-72 space-y-1.5 rounded-xl border border-cyan-300/30 bg-slate-950 px-3.5 py-3 text-slate-200 text-xs leading-relaxed shadow-2xl focus-visible:outline-2 focus-visible:outline-cyan-300"
				>
					<p className="font-bold text-sm text-white">{label}</p>
					{children}
					<Popover.Arrow className="fill-slate-950" />
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
