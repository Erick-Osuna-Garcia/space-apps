import { ExternalLink, X } from "lucide-react";
import type { Layer, Region } from "../manifest";
import { InfoHint } from "./InfoHint";
import { Panel, PanelTitle } from "./Panel";

const SOURCE_NOTICE: Partial<
	Record<Layer["source"], { label: string; help: string }>
> = {
	synthetic: {
		label: "Datos simulados",
		help: "Esta capa es una simulación de desarrollo: no son mediciones NISAR. Se reemplaza al generar la capa con datos NISAR reales.",
	},
	"sentinel-1": {
		label: "Datos Sentinel-1",
		help: "Estas fechas son anteriores a NISAR y vienen de Sentinel-1 (ESA/Copernicus), procesadas por OPERA.",
	},
	"esa-worldcover": {
		label: "Fuente: ESA WorldCover",
		help: "Mapa de cobertura de la ESA, no medido por NISAR.",
	},
	worldpop: {
		label: "Fuente: WorldPop",
		help: "Estimación de población de WorldPop; no es un censo ni viene de NISAR.",
	},
	derived: {
		label: "Dato derivado",
		help: "Calculado a partir de otros datos del explorador.",
	},
};

/** Aviso discreto y permanente cuando la capa activa no es una medición NISAR. */
export function DataNotice({ source }: { source: Layer["source"] | null }) {
	const notice = source ? SOURCE_NOTICE[source] : undefined;
	if (!notice) return null;
	return (
		<span className="pointer-events-auto mt-1.5 inline-flex items-center gap-1 text-[0.7rem] text-slate-300">
			<output className="rounded-full border border-white/15 px-2 py-0.5 font-semibold">
				{notice.label}
			</output>
			<InfoHint label={notice.label}>
				<p>{notice.help}</p>
			</InfoHint>
		</span>
	);
}

export function SidePanel({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
}) {
	// Panel no modal: no captura el teclado, así la nave se sigue pilotando con él abierto.
	return (
		<Panel
			role="complementary"
			aria-label={title}
			className="flex max-h-full w-full flex-col overflow-hidden sm:w-[26rem]"
		>
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<PanelTitle>{title}</PanelTitle>
				<button
					type="button"
					onClick={onClose}
					aria-label="Cerrar"
					className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
				>
					<X className="size-4" aria-hidden />
				</button>
			</div>
			<div className="overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-300">
				{children}
			</div>
		</Panel>
	);
}

export function ContextContent() {
	return (
		<div className="space-y-4 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-white">
			<section>
				<h3>¿Qué es SAR?</h3>
				<p>
					Un radar de apertura sintética emite su propia energía en microondas y
					mide el eco. Por eso ve de día, de noche y a través de las nubes.
					NISAR (NASA–ISRO) usa banda L (λ ≈ 24 cm), que penetra la vegetación y
					conserva bien la señal en el desierto.
				</p>
			</section>
			<section>
				<h3>¿Qué es InSAR?</h3>
				<p>
					Al comparar la <em>fase</em> de dos pasadas del satélite sobre el
					mismo lugar se obtiene un interferograma: cada ciclo de fase equivale
					a ~12 cm de cambio en la distancia suelo-satélite. Encadenando pares
					de 12 días se reconstruye cómo se movió el suelo, centímetro a
					centímetro.
				</p>
			</section>
			<section>
				<h3>Cómo leer el mapa</h3>
				<p>
					El color muestra el desplazamiento acumulado desde la primera fecha,
					en la línea de vista del radar (LOS). Los tonos café rojizo indican
					que el suelo se alejó del satélite, casi siempre por hundimiento. El
					gris marca zonas donde el radar perdió coherencia (agua, cultivos que
					cambian mucho) y no hay dato confiable. La altura del relieve está
					exagerada ×3 para que se lea en vista isométrica, y el hundimiento se
					exagera miles de veces para poder verlo: es ilustrativo. El dato real
					es el color y los centímetros de la sonda.
				</p>
			</section>
			<section>
				<h3>Las capas del mapa</h3>
				<p>
					<strong>Movimiento</strong>: cuánto y cómo se mueve el suelo,
					incluidas las zonas, dónde se dobla el terreno, la separación vertical
					y este-oeste, y los cambios bruscos. <strong>Superficie</strong>:
					construcción, vegetación y cambios, con las polarizaciones HH y HV.{" "}
					<strong>Agua</strong>: agua en superficie y humedad del suelo.{" "}
					<strong>Impacto</strong>: pendiente, población, uso de suelo y, sobre
					cualquier capa, caminos y canales. Toca un punto para ver qué dice
					cada capa de ese lugar. Estas capas señalan patrones y exposición; no
					evalúan daños ni riesgo.
				</p>
			</section>
			<section>
				<h3>Hipótesis: ¿por qué se hunde Cerro Prieto?</h3>
				<p>
					Cerro Prieto es uno de los campos geotérmicos más grandes del mundo.
					Desde los años 70 se extraen grandes volúmenes de agua y vapor del
					subsuelo para generar electricidad. Al bajar la presión en el
					yacimiento, los sedimentos se compactan y la superficie desciende
					varios centímetros al año, en un cuenco alargado sobre la zona de
					extracción. Las fallas activas del sistema Cerro Prieto–Imperial
					también influyen en la forma del cuenco.
				</p>
			</section>
			<section>
				<h3>Lo que falta y lo que viene</h3>
				<p>
					Acumulado y Velocidad mezclan movimiento vertical y horizontal; las
					capas Vertical y Este-oeste los separan combinando dos órbitas. Con
					más años de NISAR se podrán seguir mejor tendencias y ciclos de
					temporada en el Valle de Mexicali.
				</p>
			</section>
		</div>
	);
}

export function CreditsContent({
	region,
	layer,
}: {
	region: Region;
	layer: Layer | null;
}) {
	const all = [
		...region.terrain.credits,
		...(layer?.credits ?? []),
		...region.overlays.flatMap((o) => o.credits),
	];
	const credits = all.filter(
		(c, i) => all.findIndex((x) => x.name === c.name) === i,
	);
	return (
		<div className="space-y-4">
			<ul className="space-y-3">
				{credits.map((c) => (
					<li key={c.name}>
						<p className="font-semibold text-white">{c.name}</p>
						<p className="text-xs text-slate-400">{c.attribution}</p>
						{c.url.startsWith("http") && (
							<a
								href={c.url}
								target="_blank"
								rel="noreferrer"
								className="mt-0.5 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
							>
								{new URL(c.url).hostname}{" "}
								<ExternalLink className="size-3" aria-hidden />
							</a>
						)}
					</li>
				))}
			</ul>
			{layer && layer.products.length > 0 && (
				<details>
					<summary className="cursor-pointer text-xs font-semibold text-slate-200">
						{layer.products.length} productos NISAR usados en «{layer.name}»
					</summary>
					<ul className="mt-2 max-h-56 space-y-1 overflow-y-auto font-mono text-[0.65rem] text-slate-400">
						{layer.products.map((p) => (
							<li key={p} className="break-all">
								{p}
							</li>
						))}
					</ul>
				</details>
			)}
		</div>
	);
}

export function WarpOverlay({
	active,
	reducedMotion,
}: {
	active: boolean;
	reducedMotion: boolean;
}) {
	return (
		<div
			aria-hidden
			className={`warp-overlay ${active ? "warp-active" : ""} ${reducedMotion ? "warp-reduced" : ""}`}
		/>
	);
}

export function ControlsHint({ compact }: { compact: boolean }) {
	return (
		<p className="pointer-events-none rounded-xl bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
			{compact ? (
				"Toca el terreno para volar · pellizca para zoom"
			) : (
				<>
					<Kbd>W A S D</Kbd> / <Kbd>flechas</Kbd> pilotar · <Kbd>Shift</Kbd>{" "}
					turbo · clic para volar · rueda para zoom
				</>
			)}
		</p>
	);
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
	<kbd className="rounded border border-white/20 bg-white/10 px-1 font-sans text-[0.65rem] font-bold text-white">
		{children}
	</kbd>
);

export function NoWebGL() {
	return (
		<div className="mx-auto max-w-xl space-y-4 px-4 py-10">
			<Panel className="p-5">
				<h1 className="text-xl font-extrabold text-white">
					Tu navegador no soporta WebGL 2
				</h1>
				<p className="mt-2 text-sm text-slate-300">
					El explorador 3D necesita WebGL 2. Prueba con una versión reciente de
					Chrome, Firefox, Safari o Edge, o activa la aceleración por hardware.
					Mientras tanto, aquí tienes el contexto científico del proyecto.
				</p>
			</Panel>
			<Panel className="p-5 text-sm leading-relaxed text-slate-300">
				<ContextContent />
			</Panel>
		</div>
	);
}
