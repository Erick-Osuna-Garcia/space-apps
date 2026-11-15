import { Satellite } from "lucide-react";
import type { Region } from "../manifest";
import { Panel } from "./Panel";

type TopBarProps = {
	region: Region;
	exaggeration: number;
	notice?: React.ReactNode;
	compact?: boolean;
};

export const TopBar = ({
	region,
	exaggeration,
	notice,
	compact = false,
}: TopBarProps) => {
	if (compact) {
		return (
			<Panel className="min-w-0 px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					<Satellite
						className="size-4 shrink-0 stroke-[2] text-cyan-300"
						aria-hidden
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate text-[0.65rem] font-semibold text-cyan-300">
							<span translate="no">NISAR</span>
						</p>
						<h1 className="truncate text-pretty text-base font-extrabold leading-[1.1] text-white">
							{region.name}
						</h1>
					</div>
					<p className="shrink-0 text-end text-[0.65rem] text-slate-400 tabular-nums">
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
		<Panel className="min-w-0 px-4 py-3">
			<div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-300">
				<Satellite className="size-3.5 shrink-0 stroke-[2]" aria-hidden />
				<span className="truncate">Dancing with the SARs · NISAR</span>
			</div>
			<h1 className="mt-1 text-pretty text-lg font-extrabold leading-[1.1] text-white sm:text-xl">
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
	);
};
