import * as THREE from "three";
import { colormapLut, sequential } from "../lib/colormap";
import { BAND_COLORS } from "../lib/impact";

export const NODATA_SENTINEL = -9999;

/** Cómo pinta el shader la capa. */
export const PaintMode = {
	CUBE: 0,
	FIELD_DIVERGING: 1,
	FIELD_SEQUENTIAL: 2,
	BANDS: 3,
} as const;
export type PaintModeValue = (typeof PaintMode)[keyof typeof PaintMode];

export interface LayerUniforms {
	uCube: { value: THREE.DataArrayTexture };
	uLut: { value: THREE.DataTexture };
	uDateA: { value: number };
	uDateB: { value: number };
	uMix: { value: number };
	uOpacity: { value: number };
	uLimit: { value: number };
	uLayerOn: { value: number };
	uNoData: { value: THREE.Color };
	/** Ver `PaintMode`. */
	uMode: { value: number };
	/** Campo 2D de la vista activa (velocidad, diferencial o aceleración). */
	uField: { value: THREE.DataTexture };
	uFieldLimit: { value: number };
	uLutSeq: { value: THREE.DataTexture };
	uBands: { value: THREE.DataTexture };
	uBandColors: { value: THREE.Color[] };
	/** Unidades de escena por cm de desplazamiento (0 = sin hundimiento 3D). */
	uDeform: { value: number };
	/** Cubo (cm) solo para la geometría, con huecos rellenados (0 = sin desplazamiento). */
	uDeformCube: { value: THREE.DataArrayTexture };
	/** Tamaño de un texel de la grilla en coordenadas uv. */
	uTexel: { value: THREE.Vector2 };
}

function emptyCube() {
	const t = new THREE.DataArrayTexture(new Float32Array([0]), 1, 1, 1);
	t.format = THREE.RedFormat;
	t.type = THREE.FloatType;
	t.needsUpdate = true;
	return t;
}

function floatTexture(data: Float32Array, width: number, height: number) {
	const t = new THREE.DataTexture(
		data,
		width,
		height,
		THREE.RedFormat,
		THREE.FloatType,
	);
	t.minFilter = THREE.NearestFilter;
	t.magFilter = THREE.NearestFilter;
	t.unpackAlignment = 1;
	t.needsUpdate = true;
	return t;
}

/** Campo de una vista (NaN = sin dato) como textura 2D. */
export function fieldTexture(
	field: Float32Array,
	width: number,
	height: number,
) {
	const data = new Float32Array(field.length);
	for (let k = 0; k < field.length; k++) {
		const v = field[k];
		data[k] = Number.isFinite(v) ? v : NODATA_SENTINEL;
	}
	return floatTexture(data, width, height);
}

/** Bandas de la vista Zonas (un byte por celda). */
export function bandsTexture(bands: Uint8Array, width: number, height: number) {
	const t = new THREE.DataTexture(
		bands,
		width,
		height,
		THREE.RedFormat,
		THREE.UnsignedByteType,
	);
	t.minFilter = THREE.NearestFilter;
	t.magFilter = THREE.NearestFilter;
	t.unpackAlignment = 1;
	t.needsUpdate = true;
	return t;
}

function lutTexture(data = colormapLut(256)) {
	const t = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
	t.colorSpace = THREE.SRGBColorSpace;
	t.magFilter = THREE.LinearFilter;
	t.minFilter = THREE.LinearFilter;
	t.needsUpdate = true;
	return t;
}

/**
 * Convierte el cubo Int16 (T×H×W, mm con nodata) en una textura 3D float en cm.
 * Filtro "nearest": interpolar contra el centinela de nodata produciría artefactos.
 */
export function cubeTexture(
	cube: Int16Array,
	width: number,
	height: number,
	depth: number,
	scale: number,
	nodata: number,
) {
	const data = new Float32Array(cube.length);
	for (let k = 0; k < cube.length; k++) {
		const v = cube[k];
		data[k] = v === nodata ? NODATA_SENTINEL : v * scale;
	}
	const tex = new THREE.DataArrayTexture(data, width, height, depth);
	tex.format = THREE.RedFormat;
	tex.type = THREE.FloatType;
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.unpackAlignment = 1;
	tex.needsUpdate = true;
	return tex;
}

/** Cubo de geometría del hundimiento 3D (cm, NaN -> 0 = no se desplaza). */
export function deformCubeTexture(
	filled: Float32Array,
	width: number,
	height: number,
	depth: number,
) {
	const data = new Float32Array(filled.length);
	for (let k = 0; k < filled.length; k++) {
		const v = filled[k];
		data[k] = Number.isNaN(v) ? 0 : v;
	}
	const tex = new THREE.DataArrayTexture(data, width, height, depth);
	tex.format = THREE.RedFormat;
	tex.type = THREE.FloatType;
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.unpackAlignment = 1;
	tex.needsUpdate = true;
	return tex;
}

export function createLayerUniforms(): LayerUniforms {
	return {
		uCube: { value: emptyCube() },
		uLut: { value: lutTexture() },
		uDateA: { value: 0 },
		uDateB: { value: 0 },
		uMix: { value: 1 },
		uOpacity: { value: 0.85 },
		uLimit: { value: 10 },
		uLayerOn: { value: 0 },
		uNoData: { value: new THREE.Color("#6f6a75") },
		uMode: { value: 0 },
		uField: { value: floatTexture(new Float32Array([0]), 1, 1) },
		uFieldLimit: { value: 10 },
		uLutSeq: { value: lutTexture(colormapLut(256, sequential)) },
		uBands: { value: bandsTexture(new Uint8Array([1]), 1, 1) },
		uBandColors: { value: BAND_COLORS.map((c) => new THREE.Color(c)) },
		uDeform: { value: 0 },
		uDeformCube: { value: emptyCube() },
		uTexel: { value: new THREE.Vector2(1, 1) },
	};
}

/**
 * MeshStandardMaterial (iluminación estándar + tinte hipsométrico por vértice) extendido para
 * mezclar la capa de cambio de superficie interpolando entre dos fechas.
 */
export function createTerrainMaterial(uniforms: LayerUniforms) {
	const material = new THREE.MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.92,
		metalness: 0,
	});
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				`#include <common>
precision highp sampler2DArray;
attribute vec2 gridUv;
varying vec2 vGridUv;
uniform sampler2DArray uDeformCube;
uniform float uDateA, uDateB, uMix, uDeform;
uniform vec2 uTexel;
float dispAt(vec2 uv) {
  float a = texture(uDeformCube, vec3(uv, uDateA)).r;
  float b = texture(uDeformCube, vec3(uv, uDateB)).r;
  return mix(a, b, uMix);
}`,
			)
			.replace(
				"#include <beginnormal_vertex>",
				`#include <beginnormal_vertex>
if (uDeform > 0.0) {
  // normal de la superficie desplazada: gradiente del hundimiento (1 celda = 1 unidad)
  float dx = (dispAt(gridUv + vec2(uTexel.x, 0.0)) - dispAt(gridUv - vec2(uTexel.x, 0.0))) * 0.5 * uDeform;
  float dz = (dispAt(gridUv + vec2(0.0, uTexel.y)) - dispAt(gridUv - vec2(0.0, uTexel.y))) * 0.5 * uDeform;
  objectNormal = normalize(objectNormal + vec3(-dx, 0.0, -dz));
}`,
			)
			.replace(
				"#include <begin_vertex>",
				`#include <begin_vertex>
vGridUv = gridUv;
if (uDeform > 0.0) transformed.y += dispAt(gridUv) * uDeform;`,
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				`#include <common>
precision highp sampler2DArray;
uniform sampler2DArray uCube;
uniform sampler2D uLut;
uniform sampler2D uField;
uniform sampler2D uLutSeq;
uniform sampler2D uBands;
uniform vec3 uBandColors[6];
uniform vec2 uTexel;
uniform float uDateA, uDateB, uMix, uOpacity, uLimit, uLayerOn, uMode, uFieldLimit;
uniform vec3 uNoData;
varying vec2 vGridUv;
int bandAt(vec2 uv) {
  return int(texture(uBands, uv).r * 255.0 + 0.5);
}
// borde entre dos bandas, de ~1.5 px de grosor a cualquier zoom (ignora "sin dato")
bool onContour(vec2 uv, int band, vec2 w) {
  vec2 f = fract(uv / uTexel);
  vec2 d = vec2(0.0);
  if (f.x < w.x) d = vec2(-uTexel.x, 0.0);
  else if (f.x > 1.0 - w.x) d = vec2(uTexel.x, 0.0);
  int nx = bandAt(uv + d);
  d = vec2(0.0);
  if (f.y < w.y) d = vec2(0.0, -uTexel.y);
  else if (f.y > 1.0 - w.y) d = vec2(0.0, uTexel.y);
  int ny = bandAt(uv + d);
  return (nx != band && nx != 0) || (ny != band && ny != 0);
}`,
			)
			.replace(
				"#include <color_fragment>",
				`#include <color_fragment>
if (uLayerOn > 0.5 && uMode > 2.5) {
  vec2 lineWidth = fwidth(vGridUv / uTexel) * 1.5;
  int band = bandAt(vGridUv);
  if (band == 0) diffuseColor.rgb = mix(diffuseColor.rgb, uNoData, uOpacity);
  else {
    if (band != 1) diffuseColor.rgb = mix(diffuseColor.rgb, uBandColors[band], uOpacity);
    if (onContour(vGridUv, band, lineWidth)) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.9);
  }
} else if (uLayerOn > 0.5) {
  vec3 layerColor;
  float v;
  bool nodata;
  float t;
  if (uMode > 0.5) {
    v = texture(uField, vGridUv).r;
    nodata = v < ${NODATA_SENTINEL.toFixed(1)} + 1.0;
    t = uMode > 1.5
      ? clamp(v / uFieldLimit, 0.0, 1.0)
      : clamp(0.5 - v / (2.0 * uFieldLimit), 0.0, 1.0);
  } else {
    float a = texture(uCube, vec3(vGridUv, uDateA)).r;
    float b = texture(uCube, vec3(vGridUv, uDateB)).r;
    v = mix(a, b, uMix);
    nodata = a < ${NODATA_SENTINEL.toFixed(1)} + 1.0 || b < ${NODATA_SENTINEL.toFixed(1)} + 1.0;
    t = clamp(0.5 - v / (2.0 * uLimit), 0.0, 1.0);
  }
  if (nodata) layerColor = uNoData;
  else if (uMode > 1.5) layerColor = texture(uLutSeq, vec2(t, 0.5)).rgb;
  else layerColor = texture(uLut, vec2(t, 0.5)).rgb;
  diffuseColor.rgb = mix(diffuseColor.rgb, layerColor, uOpacity);
}`,
			);
	};
	material.customProgramCacheKey = () => "terrain-layer-v5";
	return material;
}
