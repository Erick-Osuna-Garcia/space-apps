import { cn } from "cn";
import { MapPin, Rocket } from "lucide-react";
import type { Manifest, Poi, Region } from "../manifest";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

interface PoiListProps {
	manifest: Manifest;
	activeRegionId: string;
	onSelect: (region: Region, poi: Poi) => void;
	compact: boolean;
}

/** Destinos de todas las regiones; los de otra región se alcanzan con warp. */
export function PoiList({
	manifest,
	activeRegionId,
	onSelect,
	compact,
}: PoiListProps) {
	const items = manifest.regions.flatMap((region) =>
		region.pois.map((poi) => ({ region, poi })),
	);
	const hasOtherRegion = manifest.regions.some(
		(region) => region.id !== activeRegionId,
	);

	if (compact) {
		return (
			<div className="pointer-events-auto flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{items.map(({ region, poi }) => (
					<button
						key={`${region.id}/${poi.id}`}
						type="button"
						onClick={() => onSelect(region, poi)}
						className={cn(
							"flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
							region.id === activeRegionId
								? "border-amber-300/40 bg-slate-950/80 text-amber-100"
								: "border-cyan-300/30 bg-slate-950/80 text-cyan-100",
						)}
					>
						{region.id === activeRegionId ? (
							<MapPin className="size-3" aria-hidden />
						) : (
							<Rocket className="size-3" aria-hidden />
						)}
						{poi.name}
					</button>
				))}
			</div>
		);
	}

	return (
		<Panel className="w-64 p-3">
			<div className="flex items-center justify-between px-1">
				<PanelTitle>Destinos</PanelTitle>
				<InfoHint label="Destinos">
					<p>
						{hasOtherRegion
							? "Lugares para visitar. El pin amarillo vuela a un punto de esta región; el cohete hace un salto (warp) a otra región."
							: "Lugares para visitar. Volar aquí lleva la nave a ese punto. Ciudad de Mexicali además marca en ámbar la zona urbana."}
					</p>
				</InfoHint>
			</div>
			<ul className="mt-2 space-y-1">
				{items.map(({ region, poi }) => {
					const here = region.id === activeRegionId;
					return (
						<li key={`${region.id}/${poi.id}`}>
							<button
								type="button"
								onClick={() => onSelect(region, poi)}
								className="group flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-cyan-300"
							>
								<span
									className={cn(
										"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg",
										here
											? "bg-amber-400/15 text-amber-300"
											: "bg-cyan-400/15 text-cyan-300",
									)}
								>
									{here ? (
										<MapPin className="size-3.5" aria-hidden />
									) : (
										<Rocket className="size-3.5" aria-hidden />
									)}
								</span>
								<span className="min-w-0">
									<span className="block text-sm font-semibold text-slate-100">
										{poi.name}
									</span>
									<span className="block text-xs text-slate-400">
										{here ? "Volar aquí" : `Warp a ${region.name}`}
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</Panel>
	);
}
