import { describe, expect, it } from "vitest";
import { createExplorerStore, layerUi } from "./store";

describe("explorer store", () => {
	it("cambiar de región reinicia la línea de tiempo y la sonda", () => {
		const store = createExplorerStore();
		store.actions.selectDate(5);
		store.actions.setPlaying(true);
		store.actions.setProbe({ col: 1, row: 1, lon: 0, lat: 0 });
		store.actions.setRegion("tijuana");
		expect(store.state).toMatchObject({
			regionId: "tijuana",
			dateIndex: 0,
			playing: false,
			probe: null,
		});
	});

	it("mover el slider pausa la reproducción", () => {
		const store = createExplorerStore();
		store.actions.setPlaying(true);
		store.actions.selectDate(3);
		expect(store.state.playing).toBe(false);
		expect(store.state.dateIndex).toBe(3);
	});

	it("la reproducción avanza en bucle", () => {
		const store = createExplorerStore();
		store.actions.selectDate(2);
		store.actions.advanceDate(3);
		expect(store.state.dateIndex).toBe(0);
		store.actions.advanceDate(3);
		expect(store.state.dateIndex).toBe(1);
	});

	it("visibilidad y opacidad por capa y región", () => {
		const store = createExplorerStore();
		expect(layerUi(store.state, "subsidence").visible).toBe(true);
		store.actions.setLayerVisible("subsidence", false);
		store.actions.setLayerOpacity("subsidence", 4);
		expect(layerUi(store.state, "subsidence")).toEqual({
			visible: false,
			opacity: 1,
		});
		store.actions.setRegion("tijuana");
		expect(layerUi(store.state, "subsidence").visible).toBe(true);
	});

	it("modos de análisis", () => {
		const store = createExplorerStore();
		expect(store.state).toMatchObject({
			colorMode: "cumulative",
			statsThreshold: 5,
			deform3d: false,
			deformFactor: 5000,
		});
		store.actions.setColorMode("velocity");
		store.actions.setStatsThreshold(10);
		store.actions.setDeform3d(true);
		store.actions.setDeformFactor(10000);
		store.actions.setRegion("tijuana");
		// los modos de análisis se conservan al cambiar de región
		expect(store.state).toMatchObject({
			colorMode: "velocity",
			statsThreshold: 10,
			deform3d: true,
			deformFactor: 10000,
		});
	});
});
