import { createStore } from "@tanstack/react-store";

export interface LayerUiState {
	visible: boolean;
	opacity: number;
}

export interface ProbeReading {
	col: number;
	row: number;
	lon: number;
	lat: number;
	/** Velocidad de la nave, en celdas por segundo. */
	vx?: number;
	vz?: number;
}

export interface ExplorerState {
	regionId: string;
	/** Estado de UI por `${regionId}/${layerId}`. */
	layers: Record<string, LayerUiState>;
	dateIndex: number;
	playing: boolean;
	probe: ProbeReading | null;
	warping: boolean;
	/** Lo que muestra el mapa; una sola vista a la vez. */
	mapView: MapView;
	/** Punto tocado en el mapa para el inspector, en coordenadas de grilla. */
	inspected: { col: number; row: number } | null;
	/** Superposiciones vectoriales apagadas por el usuario; por defecto están encendidas. */
	overlays: Record<string, boolean>;
	settingsOpen: boolean;
	eventsOpen: boolean;
	/** Hundimiento 3D exagerado (design.md D13). */
	deform3d: boolean;
	deformFactor: DeformFactor;
	/** Oleaje y ondas; la extensión del agua cambia con la fecha de todos modos. */
	waterMotion: boolean;
	contextOpen: boolean;
	creditsOpen: boolean;
}

export type MapView =
	| "cumulative"
	| "velocity"
	| "zones"
	| "differential"
	| "acceleration"
	| `layer:${string}`;
export const DEFORM_FACTORS = [2000, 5000, 10000] as const;
export type DeformFactor = (typeof DEFORM_FACTORS)[number];

export const DEFAULT_LAYER: LayerUiState = { visible: true, opacity: 0.85 };

export const initialExplorerState = (regionId = "mexicali"): ExplorerState => ({
	regionId,
	layers: {},
	dateIndex: 0,
	playing: true,
	probe: null,
	warping: false,
	mapView: "cumulative",
	inspected: null,
	overlays: {},
	settingsOpen: false,
	eventsOpen: false,
	deform3d: true,
	deformFactor: 10000,
	waterMotion: true,
	contextOpen: false,
	creditsOpen: false,
});

export const layerKey = (regionId: string, layerId: string) =>
	`${regionId}/${layerId}`;

export function createExplorerStore(initial = initialExplorerState()) {
	return createStore(initial, ({ setState, get }) => ({
		setRegion(regionId: string) {
			if (get().regionId === regionId) return;
			// la nueva región tiene otras fechas: se reinicia la línea de tiempo
			setState((s) => ({
				...s,
				regionId,
				dateIndex: 0,
				playing: true,
				probe: null,
				inspected: null,
			}));
		},
		setLayerVisible(layerId: string, visible: boolean) {
			setState((s) => {
				const key = layerKey(s.regionId, layerId);
				const prev = s.layers[key] ?? DEFAULT_LAYER;
				return { ...s, layers: { ...s.layers, [key]: { ...prev, visible } } };
			});
		},
		setLayerOpacity(layerId: string, opacity: number) {
			setState((s) => {
				const key = layerKey(s.regionId, layerId);
				const prev = s.layers[key] ?? DEFAULT_LAYER;
				const clamped = Math.min(1, Math.max(0, opacity));
				return {
					...s,
					layers: { ...s.layers, [key]: { ...prev, opacity: clamped } },
				};
			});
		},
		/** Selección manual en el slider: pausa la reproducción. */
		selectDate(index: number) {
			setState((s) => ({
				...s,
				dateIndex: Math.max(0, Math.round(index)),
				playing: false,
			}));
		},
		/** Avance automático (en bucle) durante la reproducción. */
		advanceDate(dateCount: number) {
			setState((s) =>
				dateCount <= 0 ? s : { ...s, dateIndex: (s.dateIndex + 1) % dateCount },
			);
		},
		setPlaying(playing: boolean) {
			setState((s) => ({ ...s, playing }));
		},
		setProbe(probe: ProbeReading | null) {
			setState((s) => ({ ...s, probe }));
		},
		setMapView(mapView: MapView) {
			setState((s) => ({ ...s, mapView }));
		},
		/** Cambia de capa llevando la línea de tiempo a la fecha equivalente. */
		setView(mapView: MapView, dateIndex: number) {
			setState((s) => ({ ...s, mapView, dateIndex: Math.max(dateIndex, 0) }));
		},
		setInspected(inspected: { col: number; row: number } | null) {
			setState((s) => ({ ...s, inspected }));
		},
		setEventsOpen(eventsOpen: boolean) {
			setState((s) => ({ ...s, eventsOpen }));
		},
		setSettingsOpen(settingsOpen: boolean) {
			setState((s) => ({ ...s, settingsOpen }));
		},
		setOverlay(id: string, on: boolean) {
			setState((s) => ({ ...s, overlays: { ...s.overlays, [id]: on } }));
		},
		setDeform3d(deform3d: boolean) {
			setState((s) => ({ ...s, deform3d }));
		},
		setDeformFactor(deformFactor: DeformFactor) {
			setState((s) => ({ ...s, deformFactor }));
		},
		setWaterMotion(waterMotion: boolean) {
			setState((s) => ({ ...s, waterMotion }));
		},
		setWarping(warping: boolean) {
			setState((s) => ({ ...s, warping }));
		},
		setContextOpen(contextOpen: boolean) {
			setState((s) => ({ ...s, contextOpen }));
		},
		setCreditsOpen(creditsOpen: boolean) {
			setState((s) => ({ ...s, creditsOpen }));
		},
	}));
}

export type ExplorerStore = ReturnType<typeof createExplorerStore>;

export const explorerStore = createExplorerStore();

export const overlayOn = (state: ExplorerState, id: string) =>
	state.overlays[id] !== false;

export function layerUi(state: ExplorerState, layerId: string): LayerUiState {
	return state.layers[layerKey(state.regionId, layerId)] ?? DEFAULT_LAYER;
}
