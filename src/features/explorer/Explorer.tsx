import { Canvas } from "@react-three/fiber";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "./controls/useKeyboard";
import {
	eventsQuery,
	type ImpactEvent,
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
import {
	alignSeries,
	barrierMask,
	buildZones,
	changeWord,
	cropMask,
	disturbanceWord,
	listedZones,
	moistureSeries,
	nearestWaterway,
	paintWayFlags,
	vegetationWord,
	waterBeside,
	waterLines,
	withComparison,
	zoneAt,
} from "./lib/agriculture";
import {
	buildCatalog,
	type CatalogItem,
	categoricalPlane,
	classColors,
	continuousPlane,
	displacementLayer,
	eventView,
	NO_READING,
	nearestDateIndex,
	readLayer,
	resolveView,
	SOURCE_NAMES,
	sourceAt,
} from "./lib/catalog";
import {
	elapsedText,
	nearestPoi,
	TREND_LABELS,
	trendLevel,
} from "./lib/friendly";
import { cellIndex, gridToLonLat, sampleBilinear } from "./lib/grid";
import {
	accelerationReading,
	BAND_COLORS,
	createImpactAnalysis,
	differentialReading,
	MAX_LABELED_ZONES,
	MIN_DATES_ACCELERATION,
	zoneContext,
	zoneReading,
} from "./lib/impact";
import {
	affectedSegments,
	nearestSegment,
	toSegments,
} from "./lib/infrastructure";
import { placeMapModels, urbanCityMask } from "./lib/mapModels";
import { fillForDisplay, robustLimit, velocityField } from "./lib/stats";
import { waterDateIndex, waterMask } from "./lib/water";
import type { Overlay, Poi, Region } from "./manifest";
import { createFlight, FlightContext, teleport } from "./scene/flight";
import { PaintMode } from "./scene/layerMaterial";
import { Scene } from "./scene/Scene";
import { baseHeightFn, DEFAULT_EXAGGERATION } from "./scene/terrainGeometry";
import { explorerStore, layerUi, type MapView, overlayOn } from "./store";
import { AgriculturePanel } from "./ui/AgriculturePanel";
import { DateTitle } from "./ui/DateTitle";
import { EventsList } from "./ui/EventsList";
import { Inspector, type InspectorRow } from "./ui/Inspector";
import { LayerPanel } from "./ui/LayerPanel";
import {
	ContextContent,
	ControlsHint,
	CreditsContent,
	DataNotice,
	NoWebGL,
	SidePanel,
	WarpOverlay,
} from "./ui/Overlays";
import { PoiLabels } from "./ui/PoiLabels";
import { PoiList } from "./ui/PoiList";
import { SettingsDialog } from "./ui/SettingsDialog";
import { ShipStatus } from "./ui/ShipStatus";
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
	const [layersOpen, setLayersOpen] = useState(false);
	const [compareRejected, setCompareRejected] = useState(false);

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
	const item = resolveView(catalog, state.mapView);
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

	const dateCount = timelineDates.length;
	const advance = useCallback(
		() => store.actions.advanceDate(dateCount),
		[dateCount],
	);
	const events = useQuery(eventsQuery(region));
	const goToEvent = (event: ImpactEvent) => {
		const next = catalog.find((c) => c.view === eventView(event.type));
		if (next) {
			store.actions.setView(
				next.view,
				nearestDateIndex(
					next.layer ? next.layer.dates : (timelineLayer?.dates ?? []),
					event.dateEnd ?? event.date,
				),
			);
		}
		store.actions.setPlaying(false);
		flight.target = { col: event.col, row: event.row };
	};
	const selectItem = (next: CatalogItem) =>
		store.actions.setView(
			next.view,
			nearestDateIndex(
				next.layer ? next.layer.dates : (timelineLayer?.dates ?? []),
				currentDate,
			),
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

	const agriOpen = region?.id === "mexicali" && state.agricultureOpen;
	const findLayer = (id: string) =>
		region?.layers.find((l) => l.id === id) ?? null;
	const moistureLayer = findLayer("moisture");
	const hvLayer = findLayer("hv");
	const changeLayer = findLayer("change");
	const disturbanceLayer = findLayer("disturbance");
	const moistureQ = useQuery({
		...rasterQuery(region, moistureLayer),
		enabled: Boolean(agriOpen && moistureLayer),
	});
	const hvQ = useQuery({
		...rasterQuery(region, hvLayer),
		enabled: Boolean(agriOpen && hvLayer),
	});
	const changeQ = useQuery({
		...rasterQuery(region, changeLayer),
		enabled: Boolean(agriOpen && changeLayer),
	});
	const disturbanceQ = useQuery({
		...rasterQuery(region, disturbanceLayer),
		enabled: Boolean(agriOpen && disturbanceLayer),
	});
	// biome-ignore lint/correctness/useExhaustiveDependencies: overlaySignature resume overlayData
	const waterways = useMemo(
		() =>
			overlayList.flatMap((overlay, index) => {
				if (overlay.kind !== "canal" && overlay.kind !== "river") return [];
				const features = overlayData[index]?.data ?? [];
				return [
					{
						id: overlay.id,
						kind: overlay.kind,
						features,
						segments: toSegments(features, region?.cellSizeM ?? 1),
					},
				];
			}),
		// overlaySignature resume overlayData, que cambia de identidad en cada render
		[overlaySignature, overlayList, region?.cellSizeM],
	);
	const agriMap = useMemo(() => {
		if (region?.id !== "mexicali" || !landData.data) return null;
		const barriers = barrierMask(
			region.width,
			region.height,
			waterways.flatMap((way) => way.features),
		);
		return buildZones(
			landData.data,
			region.width,
			region.height,
			region.cellSizeM,
			barriers,
		);
	}, [region, landData.data, waterways]);
	const selectedAgri =
		agriMap?.zones.find((zone) => zone.id === state.agriZoneId) ?? null;
	const agriMask = useMemo(() => {
		if (!agriOpen || !agriMap) return null;
		return cropMask(agriMap.owner, state.agriZoneId);
	}, [agriOpen, agriMap, state.agriZoneId]);
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
			crops: agriOpen,
			settlements: Boolean(landData.data),
			cars: roads.length > 0,
		});
	}, [region, landData.data, overlayList, overlaySignature, agriOpen]);
	useEffect(() => {
		if (!selectedAgri) return;
		flight.target = { col: selectedAgri.col, row: selectedAgri.row };
	}, [selectedAgri, flight]);
	const wayHit = useMemo(() => {
		if (!selectedAgri || !region) return null;
		return nearestWaterway(
			selectedAgri.cells,
			region.width,
			region.cellSizeM,
			waterways,
		);
	}, [selectedAgri, region, waterways]);
	const moistureIndex = moistureLayer
		? Math.max(nearestDateIndex(moistureLayer.dates, currentDate), 0)
		: 0;
	const signalIndex = (dates: string[]) =>
		Math.max(nearestDateIndex(dates, currentDate), 0);
	const agriPlane = region ? region.width * region.height : 0;
	const asInt16 = (data: Int16Array | Uint8Array | undefined) =>
		data instanceof Int16Array ? data : null;
	const asBytes = (data: Int16Array | Uint8Array | undefined) =>
		data instanceof Uint8Array ? data : null;

	// El inspector lee todas las capas de la región al tocar un punto.
	const inspectQueries = useQueries({
		queries: (region?.layers ?? [])
			.filter((l) => l.type === "raster")
			.map((l) => ({
				...rasterQuery(region, l),
				enabled: Boolean(state.inspected),
			})),
	});

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
			: raster
				? rasterData.data && state.probe
					? `${raster.name}: ${readLayer(raster, rasterData.data, region, state.probe.col, state.probe.row, currentDate)}`
					: null
				: zoneData
					? zoneReading(zoneData.bands[probeCell])
					: view === "differential" && field
						? differentialReading(field[probeCell])
						: view === "acceleration" && field
							? accelerationReading(field[probeCell])
							: null;

	const inspected = state.inspected;
	const inspectorRows: InspectorRow[] = [];
	if (inspected) {
		if (timelineLayer && cube.data) {
			inspectorRows.push({
				name: "Desplazamiento",
				value: readLayer(
					timelineLayer,
					cube.data,
					region,
					inspected.col,
					inspected.row,
					currentDate,
				),
			});
			const v =
				velocity?.[
					cellIndex(region.width, region.height, inspected.col, inspected.row)
				] ?? Number.NaN;
			inspectorRows.push({
				name: "Tendencia",
				value: Number.isFinite(v)
					? `${v.toFixed(1)} cm/año · ${TREND_LABELS[trendLevel(v)]}`
					: NO_READING,
			});
		}
		for (const o of overlayModels) {
			const seg = nearestSegment(o.segments, inspected.col, inspected.row);
			if (seg) {
				const f = o.features[seg.feature];
				inspectorRows.push({
					name:
						o.kind === "canal"
							? "Canal"
							: o.kind === "river"
								? "Río"
								: "Camino",
					value: f.name || f.class,
				});
			}
		}
		region.layers
			.filter((l) => l.type === "raster")
			.forEach((l, i) => {
				const data = inspectQueries[i]?.data;
				inspectorRows.push({
					name: l.name,
					value: data
						? readLayer(
								l,
								data,
								region,
								inspected.col,
								inspected.row,
								currentDate,
							)
						: inspectQueries[i]?.isError
							? NO_READING
							: "Cargando…",
				});
			});
	}
	const [inspectLon, inspectLat] = inspected
		? gridToLonLat(region, inspected.col, inspected.row)
		: [0, 0];

	const shownLayer = raster ?? activeLayer;
	const currentSource = shownLayer ? sourceAt(shownLayer, currentDate) : null;

	const sceneReady = terrain.data && readyRegion === region.id;
	const agriList = agriMap
		? listedZones(agriMap.zones)
		: { listed: [], omitted: false };
	const selectedSeries =
		selectedAgri && moistureLayer
			? moistureSeries(
					selectedAgri.cells,
					asInt16(moistureQ.data),
					moistureLayer.dates.length,
					agriPlane,
					moistureLayer.scale,
					moistureLayer.nodata,
				)
			: [];
	const compareColumns = [selectedAgri?.id, ...state.agriCompare]
		.filter((id): id is number => id !== undefined)
		.flatMap((id) => {
			const zone = agriMap?.zones[id];
			if (!zone || !moistureLayer) return [];
			return [
				{
					id,
					areaKm2: zone.areaKm2,
					values: moistureSeries(
						zone.cells,
						asInt16(moistureQ.data),
						moistureLayer.dates.length,
						agriPlane,
						moistureLayer.scale,
						moistureLayer.nodata,
					),
				},
			];
		});
	const compared = alignSeries(
		compareColumns.map((column) => ({
			dates: moistureLayer?.dates ?? [],
			values: column.values,
		})),
	);
	const waterIndex = waterLayer
		? Math.max(nearestDateIndex(waterLayer.dates, currentDate), 0)
		: 0;
	const waterTouch =
		selectedAgri && waterData.data
			? waterBeside(
					selectedAgri.cells,
					categoricalPlane(waterData.data, agriPlane, waterIndex),
					region.width,
					region.height,
				)
			: { permanent: false, fresh: false };
	const agriWater = selectedAgri
		? waterLines(
				wayHit,
				waterTouch,
				waterways.some((way) => way.kind === "river"),
			)
		: [];
	const signalDate = (dates: string[]) => signalIndex(dates);

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
								onPick={(col, row) => {
									store.actions.setInspected({ col, row });
									if (!agriMap || !landData.data) return;
									const zone = zoneAt(
										agriMap,
										landData.data,
										region.width,
										col,
										row,
									);
									if (!zone) return;
									setCompareRejected(false);
									store.actions.setAgricultureOpen(true);
									store.actions.setAgriZone(zone.id);
								}}
								overlays={overlayModels
									.filter((o) => overlayOn(state, o.id))
									.map((o) => ({
										...o,
										flags: paintWayFlags(
											o.flags,
											o.segments,
											wayHit?.overlayId === o.id ? wayHit.feature : null,
										),
									}))}
								arrows={raster?.id === "east-west" ? rasterField : null}
								zones={zones}
								agriCells={selectedAgri?.cells ?? null}
								agriMask={agriMask}
								mapModels={mapModels}
								cityMask={cityMask}
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

				<SettingsDialog
					open={state.settingsOpen}
					onOpenChange={store.actions.setSettingsOpen}
					layerVisible={mainUi.visible}
					onLayerVisible={(v) => store.actions.setLayerVisible(MAIN_LAYER, v)}
					opacity={mainUi.opacity}
					onOpacity={(v) => store.actions.setLayerOpacity(MAIN_LAYER, v)}
					hasDisplacement={Boolean(timelineLayer)}
					deform3d={state.deform3d}
					onDeform3d={store.actions.setDeform3d}
					deformFactor={state.deformFactor}
					onDeformFactor={store.actions.setDeformFactor}
					overlays={overlayModels.map((o) => ({
						id: o.id,
						name: o.name,
						on: overlayOn(state, o.id),
						km: overlayBands ? o.km : null,
					}))}
					onOverlay={store.actions.setOverlay}
					hasWater={Boolean(waterLayer)}
					waterMotion={state.waterMotion}
					onWaterMotion={store.actions.setWaterMotion}
				/>

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
						onOpenSettings={() => store.actions.setSettingsOpen(true)}
						onOpenEvents={() => store.actions.setEventsOpen(!state.eventsOpen)}
						eventsOpen={state.eventsOpen}
						contextOpen={state.contextOpen}
						creditsOpen={state.creditsOpen}
						agricultureOpen={state.agricultureOpen}
						onOpenAgriculture={
							region.id === "mexicali"
								? () => store.actions.setAgricultureOpen(!state.agricultureOpen)
								: undefined
						}
						notice={<DataNotice source={currentSource} />}
					/>
					{compact && (
						<PoiList
							manifest={manifest.data}
							activeRegionId={region.id}
							onSelect={goTo}
							compact
						/>
					)}

					<div className="flex min-h-0 flex-1 items-start justify-between gap-3">
						<div className="scroll-thin flex max-h-full min-h-0 flex-col gap-3 overflow-y-auto">
							{!compact && (
								<PoiList
									manifest={manifest.data}
									activeRegionId={region.id}
									onSelect={goTo}
									compact={false}
								/>
							)}
							{agriOpen && (
								<AgriculturePanel
									missingCover={!landLayer || landData.isError}
									loading={!landData.data && landData.isPending}
									listed={agriList.listed}
									omitted={agriList.omitted}
									selected={selectedAgri}
									rejected={compareRejected}
									moisture={selectedSeries[moistureIndex] ?? null}
									dates={moistureLayer?.dates ?? []}
									activeIndex={moistureIndex}
									selectedSeries={selectedSeries}
									columns={compareColumns.map((column, index) => ({
										...column,
										values: compared.columns[index] ?? column.values,
									}))}
									vegetation={
										selectedAgri && hvLayer
											? vegetationWord(
													selectedAgri.cells,
													asInt16(hvQ.data),
													signalDate(hvLayer.dates),
													agriPlane,
													hvLayer.scale,
													hvLayer.nodata,
												)
											: null
									}
									change={
										selectedAgri && changeLayer
											? changeWord(
													selectedAgri.cells,
													asBytes(changeQ.data),
													signalDate(changeLayer.dates),
													agriPlane,
													changeLayer.nodata,
												)
											: null
									}
									disturbance={
										selectedAgri && disturbanceLayer
											? disturbanceWord(
													selectedAgri.cells,
													asBytes(disturbanceQ.data),
													signalDate(disturbanceLayer.dates),
													agriPlane,
													disturbanceLayer.nodata,
												)
											: null
									}
									water={agriWater}
									onSelect={(id) => {
										setCompareRejected(false);
										store.actions.setAgriZone(id);
									}}
									onCompare={(id) => {
										if (state.agriZoneId === null) {
											setCompareRejected(false);
											store.actions.setAgriZone(id);
											return;
										}
										const next = withComparison(
											state.agriZoneId,
											state.agriCompare,
											id,
										);
										setCompareRejected(next.rejected);
										if (!next.rejected)
											store.actions.setAgriCompare(next.extras);
									}}
									onRemove={(id) => {
										setCompareRejected(false);
										store.actions.setAgriCompare(
											state.agriCompare.filter((item) => item !== id),
										);
									}}
									onClose={() => store.actions.setAgricultureOpen(false)}
								/>
							)}
						</div>
						<div className="scroll-thin flex max-h-full min-h-0 flex-col items-end gap-3 overflow-y-auto">
							{state.eventsOpen && (
								<SidePanel
									title="Eventos detectados"
									onClose={() => store.actions.setEventsOpen(false)}
								>
									<EventsList events={events.data ?? []} onSelect={goToEvent} />
								</SidePanel>
							)}
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
										layer={raster ?? activeLayer ?? timelineLayer}
									/>
								</SidePanel>
							)}
							{(!compact || layersOpen) &&
								!state.eventsOpen &&
								!state.contextOpen &&
								!state.creditsOpen && (
									<>
										{inspected && (
											<Inspector
												place={
													nearestPoi(
														region.pois,
														inspected.col,
														inspected.row,
														region.cellSizeM,
													)?.text ?? null
												}
												coords={`${inspectLat.toFixed(4)}°, ${inspectLon.toFixed(4)}°`}
												rows={inspectorRows}
												onClose={() => store.actions.setInspected(null)}
											/>
										)}
										<LayerPanel
											catalog={catalog}
											active={item}
											onSelect={selectItem}
											displacement={timelineLayer}
											visible={mainUi.visible}
											loading={Boolean(raster) && rasterData.isPending}
											failed={Boolean(raster) && rasterData.isError}
											fieldLimit={fieldLimit}
											zoneCount={zoneData?.zones.length ?? 0}
										/>
									</>
								)}
						</div>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<ShipStatus
							region={region}
							layer={activeLayer}
							cube={activeCube}
							probe={state.probe}
							groundM={
								state.probe && terrain.data
									? sampleBilinear(
											terrain.data,
											region.width,
											region.height,
											state.probe.col,
											state.probe.row,
										)
									: null
							}
							dateIndex={dispIndex}
							compact={compact}
							mode={view === "velocity" ? "velocity" : "cumulative"}
							reading={reading}
							loading={Boolean(activeLayer) && cube.isPending}
							failed={Boolean(activeLayer) && cube.isError}
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
					</div>
				</div>
			</div>
		</FlightContext.Provider>
	);
}
