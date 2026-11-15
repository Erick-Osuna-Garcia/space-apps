import { Canvas } from "@react-three/fiber";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "./controls/useKeyboard";
import {
	layerCubeQuery,
	manifestQuery,
	overlayQuery,
	rasterQuery,
	terrainQuery,
} from "./data/queries";
import {
	hasWebGL2,
	useIsCompact,
	usePrefersReducedMotion,
} from "./hooks/useMedia";
import { barrierMask, buildZones, cropMask } from "./lib/agriculture";
import {
	buildCatalog,
	categoricalPlane,
	classColors,
	continuousPlane,
	displacementLayer,
	nearestDateIndex,
	resolveView,
	SOURCE_NAMES,
	sourceAt,
} from "./lib/catalog";
import { elapsedText } from "./lib/friendly";
import { sampleBilinear } from "./lib/grid";
import {
	BAND_COLORS,
	createImpactAnalysis,
	MAX_LABELED_ZONES,
	MIN_DATES_ACCELERATION,
	zoneContext,
} from "./lib/impact";
import { affectedSegments, toSegments } from "./lib/infrastructure";
import { placeMapModels, urbanCityMask } from "./lib/mapModels";
import { fillForDisplay, robustLimit, velocityField } from "./lib/stats";
import { waterDateIndex, waterMask } from "./lib/water";
import type { Overlay, Poi, Region } from "./manifest";
import { createFlight, FlightContext, teleport } from "./scene/flight";
import { PaintMode } from "./scene/layerMaterial";
import { Scene } from "./scene/Scene";
import { baseHeightFn, DEFAULT_EXAGGERATION } from "./scene/terrainGeometry";
import { explorerStore, layerUi, type MapView, overlayOn } from "./store";
import { DateTitle } from "./ui/DateTitle";
import { NoWebGL, WarpOverlay } from "./ui/Overlays";
import { ParkedModelView } from "./ui/ParkedModelView";
import { PoiLabels } from "./ui/PoiLabels";
import { Timeline } from "./ui/Timeline";
import { ZoneLabels } from "./ui/ZoneLabels";

const fmtShortDate = (iso: string) =>
	new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

const NO_COLORS: string[] = [];
const NO_OVERLAYS: Overlay[] = [];

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
/** Estado de UI de la capa principal: visibilidad y opacidad son comunes a todas. */
const MAIN_LAYER = "main";
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

	const manifest = useQuery(manifestQuery);
	const region =
		manifest.data?.regions.find((r) => r.id === state.regionId) ?? null;
	const terrain = useQuery(terrainQuery(region));

	// Capa de desplazamiento: base del movimiento y del hundimiento 3D.
	const timelineLayer = displacementLayer(region);
	const mainUi = layerUi(state, MAIN_LAYER);
	const activeLayer = mainUi.visible ? timelineLayer : null;
	const cube = useQuery(layerCubeQuery(region, timelineLayer));

	// Catálogo: qué pinta el mapa y con qué fechas.
	const catalog = useMemo(
		() => (region ? buildCatalog(region, MIN_DATES_ACCELERATION) : []),
		[region],
	);
	const item = resolveView(catalog, "cumulative");
	const raster = item?.layer ?? null;
	const rasterData = useQuery(rasterQuery(region, raster));
	const timelineDates = raster ? raster.dates : (timelineLayer?.dates ?? []);
	const currentDate =
		timelineDates[Math.min(state.dateIndex, timelineDates.length - 1)] ?? null;
	// El relieve sigue a la fecha más cercana de la capa de desplazamiento.
	const dispIndex = Math.max(
		nearestDateIndex(timelineLayer?.dates ?? [], currentDate),
		0,
	);

	const activeCube = activeLayer ? (cube.data ?? null) : null;

	// Análisis de la capa: velocidad una vez por cubo.
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
	const view = item?.view ?? "cumulative";
	const zoneData = view === "zones" ? (impact?.zones(dispIndex) ?? null) : null;
	const zones = zoneData?.zones.slice(0, MAX_LABELED_ZONES) ?? [];

	// Plano de una capa raster en la fecha actual.
	const rasterIndex = raster
		? Math.max(nearestDateIndex(raster.dates, currentDate), 0)
		: 0;
	const rasterPlane = useMemo(() => {
		if (!raster || !rasterData.data || !region) return null;
		const plane = region.width * region.height;
		return raster.paint === "categorical"
			? categoricalPlane(rasterData.data, plane, rasterIndex)
			: continuousPlane(rasterData.data, raster, plane, rasterIndex);
	}, [raster, rasterData.data, region, rasterIndex]);
	const rasterBands = rasterPlane instanceof Uint8Array ? rasterPlane : null;
	const rasterField = rasterPlane instanceof Float32Array ? rasterPlane : null;

	const field =
		rasterField ??
		(view === "velocity"
			? velocity
			: view === "differential"
				? (impact?.differential(dispIndex) ?? null)
				: view === "acceleration"
					? (impact?.acceleration() ?? null)
					: null);
	const fieldLimit = raster
		? raster.paint === "diverging"
			? Math.max(Math.abs(raster.valueRange[0]), Math.abs(raster.valueRange[1]))
			: raster.valueRange[1]
		: view === "velocity"
			? velocityLimit
			: view === "differential"
				? (impact?.differentialLimit() ?? 1)
				: view === "acceleration"
					? (impact?.accelerationLimit() ?? 1)
					: 1;
	const paintMode = raster
		? raster.paint === "categorical"
			? PaintMode.BANDS
			: raster.paint === "sequential"
				? PaintMode.FIELD_SEQUENTIAL
				: PaintMode.FIELD_DIVERGING
		: view === "zones"
			? PaintMode.BANDS
			: view === "differential"
				? PaintMode.FIELD_SEQUENTIAL
				: view === "velocity" || view === "acceleration"
					? PaintMode.FIELD_DIVERGING
					: PaintMode.CUBE;
	const bandPalette = useMemo(
		() => (raster ? classColors(raster, BAND_COLORS[0]) : NO_COLORS),
		[raster],
	);

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

	const baseHeightAt = useMemo(
		() =>
			region && terrain.data
				? baseHeightFn(region, terrain.data, exaggeration)
				: () => 0,
		[region, terrain.data],
	);
	const heightAt = useMemo(() => {
		if (!region || !terrain.data) return () => 0;
		const { width: W, height: H } = region;
		const plane = W * H;
		const layer = timelineLayer;
		const offset = Math.min(dispIndex, (layer?.dates.length ?? 1) - 1) * plane;
		return (col: number, row: number) => {
			const base = baseHeightAt(col, row);
			if (!deformScale || !deformCube) return base;
			const d = sampleBilinear(deformCube, W, H, col, row, undefined, offset);
			return Number.isFinite(d) ? base + d * deformScale : base;
		};
	}, [
		region,
		terrain.data,
		baseHeightAt,
		deformScale,
		deformCube,
		timelineLayer,
		dispIndex,
	]);

	// Agua: se carga en segundo plano; si falla, el mapa sigue con su color de siempre.
	const waterLayer = region?.layers.find((l) => l.id === "water") ?? null;
	const waterData = useQuery(rasterQuery(region, waterLayer));
	const waterCube = waterData.data;
	const waterGrid = useMemo(
		() =>
			region && waterLayer && waterCube instanceof Uint8Array
				? waterMask(
						waterCube,
						region.width,
						region.height,
						waterLayer.dates.length,
					)
				: null,
		[region, waterLayer, waterCube],
	);
	const water = useMemo(
		() =>
			waterGrid && waterLayer
				? {
						mask: waterGrid,
						dates: waterLayer.dates.length,
						index: waterDateIndex(waterLayer.dates, currentDate),
					}
				: null,
		[waterGrid, waterLayer, currentDate],
	);

	// La nave, los faros y el picking siguen la superficie actual (incluido el hundimiento 3D).
	useEffect(() => {
		flight.heightAt = heightAt;
	}, [flight, heightAt]);
	const heightAtRef = useRef(heightAt);
	heightAtRef.current = heightAt;

	// Llegada a una región (inicio o tras warp): configurar el vuelo y ubicar la nave.
	const arrival = useRef<string | null>(DEFAULT_POI);
	const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
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
				setSelectedPoiId(poi.id);
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

	const dateCount = timelineDates.length;
	const advance = useCallback(
		() => store.actions.advanceDate(dateCount),
		[dateCount],
	);
	// Infraestructura: tramos resaltados según la fecha.
	const overlayList = region?.overlays ?? NO_OVERLAYS;
	const overlayData = useQueries({
		queries: overlayList.map((o) => ({
			...overlayQuery(o),
		})),
	});
	const overlayBands = overlayList.some((o) => overlayOn(state, o.id))
		? (impact?.zones(dispIndex).bands ?? null)
		: null;
	const overlayDiff = overlayBands
		? (impact?.differential(dispIndex) ?? null)
		: null;
	const overlayCut = overlayBands
		? (impact?.differentialLimit() ?? 1) * 0.6
		: 1;
	const overlaySignature = overlayData.map((d) => d.dataUpdatedAt).join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: overlaySignature resume overlayData, que cambia de identidad en cada render
	const overlayModels = useMemo(
		() =>
			overlayList.map((o, i) => {
				const features = overlayData[i]?.data ?? [];
				const segments = toSegments(features, region?.cellSizeM ?? 1);
				const hit = affectedSegments(
					segments,
					region?.width ?? 0,
					region?.height ?? 0,
					overlayBands,
					overlayDiff,
					overlayCut,
				);
				return { ...o, segments, ...hit, features };
			}),
		[
			overlaySignature,
			overlayList,
			region,
			overlayBands,
			overlayDiff,
			overlayCut,
		],
	);

	// Población y uso de suelo para las etiquetas de zona.
	const popLayer = region?.layers.find((l) => l.id === "population") ?? null;
	const landLayer = region?.layers.find((l) => l.id === "landcover") ?? null;
	const popData = useQuery({
		...rasterQuery(region, popLayer),
		enabled: Boolean(popLayer) && view === "zones",
	});
	const landData = useQuery({
		...rasterQuery(region, landLayer),
		enabled:
			Boolean(landLayer) && (view === "zones" || region?.id === "mexicali"),
	});
	const landNames = useMemo(
		() =>
			Object.fromEntries(
				(landLayer?.classes ?? []).map((c) => [c.value, c.name]),
			),
		[landLayer],
	);

	const cityMask = useMemo(() => {
		if (region?.id !== "mexicali" || !landData.data) return null;
		const city = region.pois.find((poi) => poi.id === "mexicali-centro");
		if (!city) return null;
		return urbanCityMask(
			landData.data,
			region.width,
			region.height,
			city.col,
			city.row,
		);
	}, [region, landData.data]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: overlaySignature resume overlayData, que cambia de identidad en cada render
	const mapModels = useMemo(() => {
		if (region?.id !== "mexicali") return [];
		const roads = overlayList.flatMap((overlay, index) =>
			overlay.kind === "road" ? (overlayData[index]?.data ?? []) : [],
		);
		return placeMapModels({
			landcover: landData.data ?? null,
			width: region.width,
			height: region.height,
			roads,
			crops: Boolean(landData.data),
			settlements: Boolean(landData.data),
			cars: roads.length > 0,
		});
	}, [region, landData.data, overlayList, overlaySignature]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: overlaySignature resume overlayData
	const agriMask = useMemo(() => {
		if (region?.id !== "mexicali" || !landData.data) return null;
		const waterways = overlayList.flatMap((overlay, index) =>
			overlay.kind === "canal" || overlay.kind === "river"
				? (overlayData[index]?.data ?? [])
				: [],
		);
		const barriers = barrierMask(region.width, region.height, waterways);
		const map = buildZones(
			landData.data,
			region.width,
			region.height,
			region.cellSizeM,
			barriers,
		);
		return cropMask(map.owner, null);
	}, [region, landData.data, overlayList, overlaySignature]);

	if (manifest.isError) {
		return (
			<ExplorerLoading
				label={`No se pudieron cargar los datos: ${manifest.error.message}`}
			/>
		);
	}
	if (!manifest.data || !region)
		return <ExplorerLoading label="Cargando datos de NISAR…" />;

	const shownLayer = raster ?? activeLayer;
	const currentSource = shownLayer ? sourceAt(shownLayer, currentDate) : null;

	const sceneReady = terrain.data && readyRegion === region.id;
	return (
		<FlightContext.Provider value={flight}>
			<a
				href="#mapa"
				className="sr-only focus:not-sr-only focus:absolute focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:left-3 focus:z-50 focus:rounded-lg focus:bg-cyan-300 focus:px-3 focus:py-2 focus:font-semibold focus:text-slate-950 focus:outline-2 focus:outline-offset-2 focus:outline-white"
			>
				Ir al mapa
			</a>
			<div
				id="mapa"
				className="relative h-dvh w-full overflow-hidden bg-[#05070f] text-slate-100"
			>
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
								layerVisible={mainUi.visible}
								layerOpacity={mainUi.opacity}
								dateIndex={dispIndex}
								reducedMotion={reducedMotion}
								heightAt={heightAt}
								baseHeightAt={baseHeightAt}
								paintMode={paintMode}
								field={field}
								fieldLimit={fieldLimit}
								fieldMin={
									raster?.paint === "sequential" ? raster.valueRange[0] : 0
								}
								palette={raster?.palette ?? "heat"}
								bands={rasterBands ?? zoneData?.bands ?? null}
								bandPalette={raster ? bandPalette : BAND_COLORS}
								contour={!raster}
								onPick={() => {}}
								overlays={overlayModels
									.filter((o) => overlayOn(state, o.id))
									.map((o) => ({
										...o,
										flags: o.flags,
									}))}
								arrows={raster?.id === "east-west" ? rasterField : null}
								zones={zones}
								agriCells={null}
								agriMask={agriMask}
								mapModels={mapModels}
								modelFocus={null}
								cityMask={cityMask}
								cityLive={selectedPoiId === "mexicali-centro"}
								zoneLabels={zoneLabels}
								deformScale={deformScale}
								deformCube={deformCube}
								water={water}
								waterMotion={state.waterMotion}
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
							selectedId={selectedPoiId}
							onSelect={(poi) => goTo(region, poi)}
						/>
					)}
					{sceneReady && (
						<ZoneLabels
							zones={zones}
							labels={zoneLabels}
							onSelect={(zone) => {
								setSelectedPoiId(null);
								flight.target = { col: zone.col, row: zone.row };
							}}
							context={(zone) =>
								zoneContext(
									zone,
									popData.data ?? null,
									landData.data ?? null,
									landNames,
								)
							}
						/>
					)}
					{!sceneReady && (
						<ExplorerLoading label={`Cargando relieve de ${region.name}…`} />
					)}
				</div>

				<WarpOverlay active={state.warping} reducedMotion={reducedMotion} />

				<div className="hud-safe pointer-events-none absolute inset-0 flex flex-col justify-end gap-2 sm:gap-3">
					<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
						<ParkedModelView
							models={mapModels}
							probe={state.probe}
							reducedMotion={reducedMotion}
						/>
						<div className="flex min-w-0 flex-1 flex-col items-center gap-2">
							{dateCount > 0 && currentDate ? (
								<div className="w-full max-w-2xl">
									<DateTitle
										date={fmtShortDate(currentDate)}
										subtitle={[
											elapsedText(timelineDates[0], currentDate),
											currentSource && SOURCE_NAMES[currentSource],
										]
											.filter(Boolean)
											.join(" · ")}
										announce={!state.playing}
									/>
									<Timeline
										dates={timelineDates}
										index={Math.min(state.dateIndex, dateCount - 1)}
										playing={state.playing}
										onSelect={store.actions.selectDate}
										onPlaying={store.actions.setPlaying}
										onAdvance={advance}
										ready={
											raster ? Boolean(rasterData.data) : Boolean(activeCube)
										}
										note={
											activeLayer
												? timelineNote(view, state.deform3d)
												: undefined
										}
									/>
								</div>
							) : (
								raster?.referenceDate && (
									<DateTitle
										date={raster.referenceDate.slice(0, 4)}
										subtitle="Capa estática, sin línea de tiempo"
										announce
									/>
								)
							)}
						</div>
					</div>
				</div>
			</div>
		</FlightContext.Provider>
	);
}
