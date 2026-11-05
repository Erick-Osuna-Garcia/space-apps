import { Mountain, Route, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Slider } from "#/components/ui/slider";
import { Switch } from "#/components/ui/switch";
import { DEFORM_FACTORS, type DeformFactor } from "../store";
import { Segmented } from "./LayerPanel";

interface SettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	layerVisible: boolean;
	onLayerVisible: (visible: boolean) => void;
	opacity: number;
	onOpacity: (opacity: number) => void;
	hasDisplacement: boolean;
	deform3d: boolean;
	onDeform3d: (on: boolean) => void;
	deformFactor: DeformFactor;
	onDeformFactor: (factor: DeformFactor) => void;
	overlays: Array<{ id: string; name: string; on: boolean; km: number | null }>;
	onOverlay: (id: string, on: boolean) => void;
}

function Row({
	id,
	label,
	detail,
	checked,
	onChange,
}: {
	id: string;
	label: string;
	detail?: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4 py-1.5">
			<label htmlFor={id} className="min-w-0">
				<span className="block font-semibold text-slate-100 text-sm">
					{label}
				</span>
				{detail && (
					<span className="block text-slate-400 text-xs">{detail}</span>
				)}
			</label>
			<Switch id={id} checked={checked} onCheckedChange={onChange} />
		</div>
	);
}

const Heading = ({ children }: { children: React.ReactNode }) => (
	<h3 className="mt-4 flex items-center gap-1.5 font-bold text-[0.68rem] text-slate-400 uppercase tracking-[0.16em]">
		{children}
	</h3>
);

/** Ajustes de lo que se dibuja en el mapa. */
export function SettingsDialog({
	open,
	onOpenChange,
	layerVisible,
	onLayerVisible,
	opacity,
	onOpacity,
	hasDisplacement,
	deform3d,
	onDeform3d,
	deformFactor,
	onDeformFactor,
	overlays,
	onOverlay,
}: SettingsDialogProps) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
				<Dialog.Content className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-5 text-slate-100 shadow-2xl">
					<div className="flex items-center justify-between">
						<Dialog.Title className="font-extrabold text-lg text-white">
							Ajustes
						</Dialog.Title>
						<Dialog.Close
							aria-label="Cerrar ajustes"
							className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
						>
							<X className="size-5" aria-hidden />
						</Dialog.Close>
					</div>
					<Dialog.Description className="sr-only">
						Activa o desactiva lo que se dibuja en el mapa.
					</Dialog.Description>

					<Heading>Mapa</Heading>
					<Row
						id="set-layer"
						label="Mostrar capa"
						checked={layerVisible}
						onChange={onLayerVisible}
					/>
					<div className="flex items-center gap-3 py-1.5">
						<span className="text-slate-300 text-sm">Opacidad</span>
						<Slider
							aria-label="Opacidad de la capa"
							min={0}
							max={1}
							step={0.05}
							value={[opacity]}
							onValueChange={([v]) => onOpacity(v)}
						/>
					</div>

					{overlays.length > 0 && (
						<>
							<Heading>
								<Route className="size-3.5" aria-hidden /> Infraestructura
							</Heading>
							{overlays.map((o) => (
								<Row
									key={o.id}
									id={`set-${o.id}`}
									label={o.name}
									detail={
										o.on && o.km !== null
											? `${o.km.toFixed(1)} km en zona de cambio`
											: undefined
									}
									checked={o.on}
									onChange={(v) => onOverlay(o.id, v)}
								/>
							))}
							<p className="mt-1 text-slate-400 text-xs">
								En rojo, los tramos en zona de cambio. Muestra exposición; no
								confirma daños.
							</p>
						</>
					)}

					{hasDisplacement && (
						<>
							<Heading>
								<Mountain className="size-3.5" aria-hidden /> Relieve
							</Heading>
							<Row
								id="set-3d"
								label="Hundimiento 3D"
								detail="Exagerado miles de veces: solo ilustrativo"
								checked={deform3d}
								onChange={onDeform3d}
							/>
							{deform3d && (
								<Segmented
									label="Exageración"
									value={deformFactor}
									onChange={onDeformFactor}
									options={DEFORM_FACTORS.map((f) => ({
										value: f,
										label: `×${f.toLocaleString("es-MX")}`,
									}))}
								/>
							)}
						</>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
