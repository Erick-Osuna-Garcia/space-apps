import { Canvas } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "./controls/useKeyboard";
import { layerCubeQuery, manifestQuery, terrainQuery } from "./data/queries";
import {
	hasWebGL2,
	useIsCompact,
	usePrefersReducedMotion,
} from "./hooks/useMedia";
import { cellIndex, sampleBilinear } from "./lib/grid";
import {
	accelerationReading,
	createImpactAnalysis,
	differentialReading,
	MAX_LABELED_ZONES,
	MIN_DATES_ACCELERATION,
	zoneReading,
} from "./lib/impact";
import {
	dateStats,
	fillForDisplay,
	robustLimit,
	velocityField,
} from "./lib/stats";
import type { Poi, Region } from "./manifest";
import { createFlight, FlightContext, teleport } from "./scene/flight";
import { PaintMode } from "./scene/layerMaterial";
import { Scene } from "./scene/Scene";
import { DEFAULT_EXAGGERATION, verticalScale } from "./scene/terrainGeometry";
import { explorerStore, layerUi, type MapView } from "./store";
import { LayerPanel } from "./ui/LayerPanel";
import {
	ContextContent,
	ControlsHint,
	CreditsContent,
	DataNotice,
	DeformBadge,
	NoWebGL,
	SidePanel,
	WarpOverlay,
} from "./ui/Overlays";
import { PoiLabels } from "./ui/PoiLabels";
import { PoiList } from "./ui/PoiList";
import { Probe } from "./ui/Probe";
import { StatsPanel } from "./ui/StatsPanel";
import { Timeline } from "./ui/Timeline";
import { TopBar } from "./ui/TopBar";
import { ZoneLabels } from "./ui/ZoneLabels";

const fmtShortDate = (iso: string) =>
	new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

function timelineNote(view: MapView, deform3d: boolean) {
	if (view !== "velocity" && view !== "acceleration") return undefined;
	const base =
		view === "velocity"
			? "La velocidad no depende de la fecha: es la tendencia de toda la serie."
			: "La aceleración no depende de la fecha: compara las dos mitades de la serie.";
	return deform3d ? `${base} El relieve 3D sí sigue la fecha.` : base;
}

const WARP_OUT_MS = 450;
const WARP_IN_MS = 400;
const DEFAULT_POI = "cerro-prieto";
const exaggeration = DEFAULT_EXAGGERATION;
const store = explorerStore;

export function Explorer() {
	const [webgl] = useState(hasWebGL2);
	if (!webgl) return <NoWebGL />;
	return <ExplorerScene />;
}

export function ExplorerLoading({
	label = "Preparando el explorador…",
}: {
	label?: string;
}) {
	return (
		<div className="flex h-dvh items-center justify-center bg-[#05070f] text-slate-300">
			<p className="flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden /> {label}
			</p>
		</div>
	);
}

function ExplorerScene() {
	const state = useSelector(store);
	const reducedMotion = usePrefersReducedMotion();
	const compact = useIsCompact();
	const keys = useKeyboard();
	const labels = useRef(new Map<string, HTMLElement>());
	const zoneLabels = useRef(new Map<string, HTMLElement>());
	const flight = useMemo(createFlight, []);
	const [layersOpen, setLayersOpen] = useState(false);

	const manifest = useQuery(manifestQuery);
	const region =
		manifest.data?.regions.find((r) => r.id === state.regionId) ?? null;
	const terrain = useQuery(terrainQuery(region));

	const activeLayer =
		region?.layers.find((l) => layerUi(state, l.id).visible) ?? null;
	const timelineLayer = activeLayer ?? region?.layers[0] ?? null;
	const cube = useQuery(layerCubeQuery(region, timelineLayer));

	const activeCube = activeLayer ? (cube.data ?? null) : null;

	// Análisis de la capa (design.md D12): velocidad una vez por cubo, estadísticas por fecha.
	const velocity = useMemo(
		() =>
			region && timelineLayer && cube.data
				? velocityField(cube.data, {
						width: region.width,
						height: region.height,
						dates: timelineLayer.dates,
						scale: timelineLayer.scale,
						nodata: timelineLayer.nodata,
					})
				: null,
		[region, timelineLayer, cube.data],
	);
	const velocityLimit = useMemo(
		() => (velocity ? robustLimit(velocity) : 1),
		[velocity],
	);
	const stats = useMemo(
		() =>
			region && timelineLayer && activeCube && velocity
				? dateStats(
						activeCube,
						{
							width: region.width,
							height: region.height,
							dates: timelineLayer.dates,
							scale: timelineLayer.scale,
							nodata: timelineLayer.nodata,
						},
						velocity,
						state.dateIndex,
						state.statsThreshold,
						region.cellSizeM,
					)
				: null,
		[
			region,
			timelineLayer,
			activeCube,
			velocity,
			state.dateIndex,
			state.statsThreshold,
		],
	);

	// Vistas de impacto: lo que pinta el mapa según el selector.
	const impact = useMemo(
		() =>
			region && timelineLayer && activeCube && velocity
				? createImpactAnalysis(
						activeCube,
						{
							width: region.width,
							height: region.height,
							dates: timelineLayer.dates,
							scale: timelineLayer.scale,
							nodata: timelineLayer.nodata,
						},
						velocity,
						region.cellSizeM,
					)
				: null,
		[region, timelineLayer, activeCube, velocity],
	);
	const accelerationAvailable =
		(timelineLayer?.dates.length ?? 0) >= MIN_DATES_ACCELERATION;
	const view =
		state.mapView === "acceleration" && !accelerationAvailable
			? "cumulative"
			: state.mapView;
	const zoneData =
		view === "zones" ? (impact?.zones(state.dateIndex) ?? null) : null;
	const zones = zoneData?.zones.slice(0, MAX_LABELED_ZONES) ?? [];
	const field =
		view === "velocity"
			? velocity
			: view === "differential"
				? (impact?.differential(state.dateIndex) ?? null)
				: view === "acceleration"
					? (impact?.acceleration() ?? null)
					: null;
	const fieldLimit =
		view === "velocity"
			? velocityLimit
			: view === "differential"
				? (impact?.differentialLimit() ?? 1)
				: view === "acceleration"
					? (impact?.accelerationLimit() ?? 1)
					: 1;
	const paintMode =
		view === "zones"
			? PaintMode.BANDS
			: view === "differential"
				? PaintMode.FIELD_SEQUENTIAL
				: view === "velocity" || view === "acceleration"
					? PaintMode.FIELD_DIVERGING
					: PaintMode.CUBE;

	// Hundimiento 3D (D13): unidades de escena por cm, ×N respecto a la escala horizontal.
	const deformScale =
		state.deform3d && region && activeCube
			? state.deformFactor / 100 / region.cellSizeM
			: 0;

	// Cubo de geometría con huecos rellenados: solo se calcula si se activa el 3D.
	const deformCube = useMemo(
		() =>
			state.deform3d && region && timelineLayer && activeCube
				? fillForDisplay(activeCube, {
						width: region.width,
						height: region.height,
						dates: timelineLayer.dates,
						scale: timelineLayer.scale,
						nodata: timelineLayer.nodata,
					})
				: null,
		[state.deform3d, region, timelineLayer, activeCube],
	);

	const heightAt = useMemo(() => {
		if (!region || !terrain.data) return () => 0;
		const vs = verticalScale(region, exaggeration);
		const data = terrain.data;
		const { width: W, height: H } = region;
		const plane = W * H;
		const layer = timelineLayer;
		const offset =
			Math.min(state.dateIndex, (layer?.dates.length ?? 1) - 1) * plane;
		return (col: number, row: number) => {
			const base = sampleBilinear(data, W, H, col, row) * vs;
			if (!deformScale || !deformCube) return base;
			const d = sampleBilinear(deformCube, W, H, col, row, undefined, offset);
			return Number.isFinite(d) ? base + d * deformScale : base;
		};
	}, [
		region,
		terrain.data,
		deformScale,
		deformCube,
		timelineLayer,
		state.dateIndex,
	]);

	// La nave, los faros y el picking siguen la superficie actual (incluido el hundimiento 3D).
	useEffect(() => {
		flight.heightAt = heightAt;
	}, [flight, heightAt]);
	const heightAtRef = useRef(heightAt);
	heightAtRef.current = heightAt;

	// Llegada a una región (inicio o tras warp): configurar el vuelo y ubicar la nave.
	const arrival = useRef<string | null>(DEFAULT_POI);
	const [readyRegion, setReadyRegion] = useState<string | null>(null);
	useEffect(() => {
		if (!region || !terrain.data) return;
		flight.width = region.width;
		flight.height = region.height;
		flight.heightAt = heightAtRef.current;
		const poi =
			region.pois.find((p) => p.id === arrival.current) ??
			region.pois[0] ??
			null;
		teleport(
			flight,
			poi?.col ?? region.width / 2,
			poi?.row ?? region.height / 2,
		);
		arrival.current = null;
		setReadyRegion(region.id);
		if (store.state.warping) {
			const id = window.setTimeout(
				() => store.actions.setWarping(false),
				reducedMotion ? 0 : WARP_IN_MS,
			);
			return () => window.clearTimeout(id);
		}
	}, [region, terrain.data, flight, reducedMotion]);

	const goTo = useCallback(
		(target: Region, poi: Poi) => {
			if (target.id === store.state.regionId) {
				flight.target = { col: poi.col, row: poi.row };
				return;
			}
			if (store.state.warping) return;
			arrival.current = poi.id;
			store.actions.setWarping(true);
			window.setTimeout(
				() => store.actions.setRegion(target.id),
				reducedMotion ? 0 : WARP_OUT_MS,
			);
		},
		[flight, reducedMotion],
	);

	// Con movimiento reducido no arranca sola (ni al cambiar de región).
	// biome-ignore lint/correctness/useExhaustiveDependencies: region?.id es el disparador
	useEffect(() => {
		if (reducedMotion) store.actions.setPlaying(false);
	}, [reducedMotion, region?.id]);

	const advance = useCallback(
		() => store.actions.advanceDate(timelineLayer?.dates.length ?? 0),
		[timelineLayer],
	);

	if (manifest.isError) {
		return (
			<ExplorerLoading
				label={`No se pudieron cargar los datos: ${manifest.error.message}`}
			/>
		);
	}
	if (!manifest.data || !region)
		return <ExplorerLoading label="Cargando datos de NISAR…" />;

	const probeCell = state.probe
		? cellIndex(region.width, region.height, state.probe.col, state.probe.row)
		: -1;
	const reading =
		probeCell < 0
			? null
			: zoneData
				? zoneReading(zoneData.bands[probeCell])
				: view === "differential" && field
					? differentialReading(field[probeCell])
					: view === "acceleration" && field
						? accelerationReading(field[probeCell])
						: null;

	const sceneReady = terrain.data && readyRegion === region.id;
	const ui = activeLayer ? layerUi(state, activeLayer.id) : null;

	return (
		<FlightContext.Provider value={flight}>
			<div className="relative h-dvh w-full overflow-hidden bg-[#05070f] text-slate-100">
				<div className="absolute inset-0">
					{sceneReady && terrain.data && (
						<Canvas
							dpr={[1, 1.5]}
							gl={{ antialias: true, powerPreference: "high-performance" }}
						>
							<Scene
								region={region}
								heights={terrain.data}
								exaggeration={exaggeration}
								step={compact ? 2 : 1}
								layer={activeLayer}
								cube={activeCube}
								layerVisible={Boolean(ui?.visible)}
								layerOpacity={ui?.opacity ?? 0}
								dateIndex={state.dateIndex}
								reducedMotion={reducedMotion}
								heightAt={heightAt}
								paintMode={paintMode}
								field={field}
								fieldLimit={fieldLimit}
								bands={zoneData?.bands ?? null}
								zones={zones}
								zoneLabels={zoneLabels}
								deformScale={deformScale}
								deformCube={deformCube}
								keys={keys}
								labels={labels}
								store={store}
							/>
						</Canvas>
					)}
					{sceneReady && (
						<PoiLabels
							pois={region.pois}
							labels={labels}
							onSelect={(poi) => goTo(region, poi)}
						/>
					)}
					{sceneReady && (
						<ZoneLabels
							zones={zones}
							labels={zoneLabels}
							onSelect={(zone) => {
								flight.target = { col: zone.col, row: zone.row };
							}}
						/>
					)}
					{!sceneReady && (
						<ExplorerLoading label={`Cargando relieve de ${region.name}…`} />
					)}
				</div>

				<WarpOverlay active={state.warping} reducedMotion={reducedMotion} />

				{/* HUD */}
				<div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4">
					<TopBar
						region={region}
						exaggeration={exaggeration}
						onOpenContext={() =>
							store.actions.setContextOpen(!state.contextOpen)
						}
						onOpenCredits={() =>
							store.actions.setCreditsOpen(!state.creditsOpen)
						}
					/>
					<div className="flex flex-wrap justify-center gap-2">
						<DataNotice layer={activeLayer} />
						{deformScale > 0 && <DeformBadge factor={state.deformFactor} />}
					</div>
					{compact && (
						<PoiList
							manifest={manifest.data}
							activeRegionId={region.id}
							onSelect={goTo}
							compact
						/>
					)}

					<div className="flex min-h-0 flex-1 items-start justify-between gap-3">
						<div className="flex max-h-full min-h-0 flex-col gap-3 overflow-y-auto">
							{!compact && (
								<PoiList
									manifest={manifest.data}
									activeRegionId={region.id}
									onSelect={goTo}
									compact={false}
								/>
							)}
							{!compact && stats && timelineLayer && (
								<StatsPanel
									stats={stats}
									date={fmtShortDate(timelineLayer.dates[state.dateIndex])}
									threshold={state.statsThreshold}
									onThreshold={store.actions.setStatsThreshold}
									onFlyToMax={() => {
										if (stats.maxCell) flight.target = { ...stats.maxCell };
									}}
									compact={compact}
								/>
							)}
						</div>
						<div className="flex max-h-full min-h-0 flex-col items-end gap-3 overflow-y-auto">
							{state.contextOpen && (
								<SidePanel
									title="Contexto científico"
									onClose={() => store.actions.setContextOpen(false)}
								>
									<ContextContent />
								</SidePanel>
							)}
							{state.creditsOpen && (
								<SidePanel
									title="Créditos y procedencia"
									onClose={() => store.actions.setCreditsOpen(false)}
								>
									<CreditsContent
										region={region}
										layer={activeLayer ?? timelineLayer}
									/>
								</SidePanel>
							)}
							{(!compact || layersOpen) &&
								!state.contextOpen &&
								!state.creditsOpen && (
									<>
										<LayerPanel
											region={region}
											ui={(id) => layerUi(state, id)}
											onVisible={store.actions.setLayerVisible}
											onOpacity={store.actions.setLayerOpacity}
											view={view}
											onView={store.actions.setMapView}
											fieldLimit={fieldLimit}
											zoneCount={zoneData?.zones.length ?? 0}
											accelerationAvailable={accelerationAvailable}
											deform3d={state.deform3d}
											deformFactor={state.deformFactor}
											onDeform3d={store.actions.setDeform3d}
											onDeformFactor={store.actions.setDeformFactor}
										/>
										{compact && stats && timelineLayer && (
											<StatsPanel
												stats={stats}
												date={fmtShortDate(
													timelineLayer.dates[state.dateIndex],
												)}
												threshold={state.statsThreshold}
												onThreshold={store.actions.setStatsThreshold}
												onFlyToMax={() => {
													if (stats.maxCell)
														flight.target = { ...stats.maxCell };
												}}
												compact={compact}
											/>
										)}
									</>
								)}
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<Probe
							region={region}
							layer={activeLayer}
							cube={activeCube}
							probe={state.probe}
							dateIndex={state.dateIndex}
							compact={compact}
							mode={view === "velocity" ? "velocity" : "cumulative"}
							reading={reading}
							loading={Boolean(activeLayer) && cube.isPending}
							failed={Boolean(activeLayer) && cube.isError}
						/>
						<div className="flex min-w-0 flex-1 flex-col items-center gap-2">
							{timelineLayer && (
								<div className="w-full max-w-2xl">
									<Timeline
										dates={timelineLayer.dates}
										index={state.dateIndex}
										playing={state.playing}
										onSelect={store.actions.selectDate}
										onPlaying={store.actions.setPlaying}
										onAdvance={advance}
										ready={Boolean(activeCube)}
										note={
											activeLayer
												? timelineNote(view, state.deform3d)
												: undefined
										}
									/>
								</div>
							)}
							{compact && (
								<button
									type="button"
									onClick={() => setLayersOpen((v) => !v)}
									aria-expanded={layersOpen}
									className="pointer-events-auto rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur"
								>
									{layersOpen ? "Ocultar capas y leyenda" : "Capas y leyenda"}
								</button>
							)}
							<ControlsHint compact={compact} />
						</div>
						{timelineLayer && (
							<output className="pointer-events-auto self-end rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-2.5 text-right shadow-2xl backdrop-blur-md">
								<span className="block font-bold text-[0.68rem] text-slate-400 uppercase tracking-[0.16em]">
									Fecha:
								</span>
								<span className="block whitespace-nowrap font-extrabold text-white text-xl tabular-nums sm:text-2xl">
									{fmtShortDate(
										timelineLayer.dates[
											Math.min(state.dateIndex, timelineLayer.dates.length - 1)
										],
									)}
								</span>
							</output>
						)}
					</div>
				</div>
			</div>
		</FlightContext.Provider>
	);
}
