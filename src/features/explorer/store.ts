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
}

export interface ExplorerState {
	regionId: string;
	/** Estado de UI por `${regionId}/${layerId}`. */
	layers: Record<string, LayerUiState>;
	dateIndex: number;
	playing: boolean;
	probe: ProbeReading | null;
	warping: boolean;
	/** Coloración de la capa: acumulado a la fecha o velocidad (cm/año). */
	colorMode: ColorMode;
	/** Umbral de hundimiento (cm) para las estadísticas. */
	statsThreshold: StatsThreshold;
	/** Hundimiento 3D exagerado (design.md D13). */
	deform3d: boolean;
	deformFactor: DeformFactor;
	contextOpen: boolean;
	creditsOpen: boolean;
}

export type ColorMode = "cumulative" | "velocity";
export const STATS_THRESHOLDS = [2, 5, 10] as const;
export type StatsThreshold = (typeof STATS_THRESHOLDS)[number];
export const DEFORM_FACTORS = [2000, 5000, 10000] as const;
export type DeformFactor = (typeof DEFORM_FACTORS)[number];

export const DEFAULT_LAYER: LayerUiState = { visible: true, opacity: 0.85 };

export const initialExplorerState = (regionId = "mexicali"): ExplorerState => ({
	regionId,
	layers: {},
	dateIndex: 0,
	playing: false,
	probe: null,
	warping: false,
	colorMode: "cumulative",
	statsThreshold: 5,
	deform3d: false,
	deformFactor: 5000,
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
				playing: false,
				probe: null,
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
		setColorMode(colorMode: ColorMode) {
			setState((s) => ({ ...s, colorMode }));
		},
		setStatsThreshold(statsThreshold: StatsThreshold) {
			setState((s) => ({ ...s, statsThreshold }));
		},
		setDeform3d(deform3d: boolean) {
			setState((s) => ({ ...s, deform3d }));
		},
		setDeformFactor(deformFactor: DeformFactor) {
			setState((s) => ({ ...s, deformFactor }));
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

export function layerUi(state: ExplorerState, layerId: string): LayerUiState {
	return state.layers[layerKey(state.regionId, layerId)] ?? DEFAULT_LAYER;
}
