import * as THREE from "three";
import {
	colormapLut,
	PALETTES,
	type Palette,
	sequential,
} from "../lib/colormap";
import { BAND_COLORS } from "../lib/impact";
import { MAX_RIPPLES } from "../lib/water";

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
	/** Valor del inicio de la escala secuencial. */
	uFieldMin: { value: number };
	/** Dibujar contornos entre bandas (vista Zonas). */
	uContour: { value: number };
	uLutSeq: { value: THREE.DataTexture };
	uBands: { value: THREE.DataTexture };
	uBandColors: { value: THREE.Color[] };
	/** Unidades de escena por cm de desplazamiento (0 = sin hundimiento 3D). */
	uDeform: { value: number };
	/** Cubo (cm) solo para la geometría, con huecos rellenados (0 = sin desplazamiento). */
	uDeformCube: { value: THREE.DataArrayTexture };
	/** Tamaño de un texel de la grilla en coordenadas uv. */
	uTexel: { value: THREE.Vector2 };
	/** Máscara de agua por fecha: R permanente, G nueva. */
	uWater: { value: THREE.DataArrayTexture };
	uWaterOn: { value: number };
	uWaterA: { value: number };
	uWaterB: { value: number };
	uWaterMix: { value: number };
	/** Segundos de animación; se congela con el agua quieta. */
	uTime: { value: number };
	/** 0 fuera, 1 zona de cultivo, 2 la zona elegida. */
	uAgri: { value: THREE.DataTexture };
	uAgriOn: { value: number };
	/** Ondas: col, fila y momento de nacimiento. */
	uRipples: { value: THREE.Vector3[] };
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

/** Máscara de agua (dos bytes por celda) con filtro lineal, para bordes suaves. */
export function waterTexture(
	mask: Uint8Array,
	width: number,
	height: number,
	depth: number,
) {
	const tex = new THREE.DataArrayTexture(mask, width, height, depth);
	tex.format = THREE.RGFormat;
	tex.type = THREE.UnsignedByteType;
	tex.minFilter = THREE.LinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.unpackAlignment = 1;
	tex.needsUpdate = true;
	return tex;
}

/** Colores por valor de banda, siempre 16 para el uniform del shader. */
export function bandColors(colors: string[]) {
	return Array.from(
		{ length: 16 },
		(_, i) => new THREE.Color(colors[i] ?? "#000000"),
	);
}

/** LUT de una paleta, para el modo secuencial. */
export function paletteLut(palette: Palette) {
	return lutTexture(colormapLut(256, PALETTES[palette]));
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
		uFieldMin: { value: 0 },
		uContour: { value: 1 },
		uLutSeq: { value: lutTexture(colormapLut(256, sequential)) },
		uBands: { value: bandsTexture(new Uint8Array([1]), 1, 1) },
		uBandColors: { value: bandColors(BAND_COLORS) },
		uDeform: { value: 0 },
		uDeformCube: { value: emptyCube() },
		uTexel: { value: new THREE.Vector2(1, 1) },
		uWater: { value: waterTexture(new Uint8Array(2), 1, 1, 1) },
		uWaterOn: { value: 0 },
		uWaterA: { value: 0 },
		uWaterB: { value: 0 },
		uWaterMix: { value: 1 },
		uTime: { value: 0 },
		uRipples: {
			value: Array.from(
				{ length: MAX_RIPPLES },
				() => new THREE.Vector3(0, 0, -1e4),
			),
		},
		uAgri: { value: bandsTexture(new Uint8Array([0]), 1, 1) },
		uAgriOn: { value: 0 },
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
uniform vec3 uBandColors[16];
uniform vec2 uTexel;
uniform float uDateA, uDateB, uMix, uOpacity, uLimit, uLayerOn, uMode, uFieldLimit, uFieldMin, uContour;
uniform vec3 uNoData;
uniform sampler2DArray uWater;
uniform sampler2D uAgri;
uniform float uWaterOn, uWaterA, uWaterB, uWaterMix, uTime, uAgriOn;
uniform vec3 uRipples[${MAX_RIPPLES}];
varying vec2 vGridUv;
// oleaje: gradiente de cuatro ondas direccionales, en celdas
vec2 waveGradient(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d = vec2(0.86, 0.5);  g += d * cos(dot(p, d) * 1.7 + t * 1.1);
  d = vec2(-0.45, 0.89);     g += d * cos(dot(p, d) * 2.6 - t * 1.4) * 0.7;
  d = vec2(0.31, -0.95);     g += d * cos(dot(p, d) * 4.3 + t * 1.9) * 0.45;
  d = vec2(-0.97, -0.24);    g += d * cos(dot(p, d) * 6.1 - t * 2.3) * 0.3;
  return g;
}
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
// la capa gana donde tiene dato; el agua va en el resto
bool layerPainted = false;
vec2 cellPos = vGridUv / uTexel;
float cellPx = fwidth(cellPos.x);
if (uLayerOn > 0.5 && uMode > 2.5) {
  vec2 lineWidth = fwidth(vGridUv / uTexel) * 1.5;
  int band = bandAt(vGridUv);
  if (band == 0) diffuseColor.rgb = mix(diffuseColor.rgb, uNoData, uOpacity);
  else {
    if (band != 1) {
      diffuseColor.rgb = mix(diffuseColor.rgb, uBandColors[band], uOpacity);
      layerPainted = true;
    }
    if (uContour > 0.5 && onContour(vGridUv, band, lineWidth)) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.9);
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
      ? clamp((v - uFieldMin) / (uFieldLimit - uFieldMin), 0.0, 1.0)
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
  layerPainted = !nodata;
}
float waterAmount = 0.0;
vec2 waterSlope = vec2(0.0);
float waterGlint = 0.0;
if (uWaterOn > 0.5 && !layerPainted) {
  vec2 cover = mix(
    texture(uWater, vec3(vGridUv, uWaterA)).rg,
    texture(uWater, vec3(vGridUv, uWaterB)).rg,
    uWaterMix
  );
  float permanent = smoothstep(0.3, 0.5, cover.r);
  float fresh = smoothstep(0.3, 0.5, cover.g) * (1.0 - permanent);
  // el agua nueva no está confirmada: más clara y dejando ver el terreno
  waterAmount = permanent + fresh * 0.62;
  if (waterAmount > 0.001) {
    // de lejos las ondas serían más finas que un píxel
    float detail = 1.0 - smoothstep(0.25, 1.2, cellPx);
    vec2 slope = waveGradient(cellPos, uTime) * 0.1 * detail;
    float foam = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec3 ripple = uRipples[i];
      float age = uTime - ripple.z;
      if (age < 0.0 || age > 2.5) continue;
      vec2 away = cellPos - ripple.xy;
      float dist = length(away) + 1e-4;
      float ring = exp(-pow((dist - age * 2.4) / 0.55, 2.0)) * (1.0 - age / 2.5);
      slope += away / dist * ring * 0.9;
      foam += ring;
    }
    waterSlope = slope;
    vec3 deep = mix(vec3(0.014, 0.1, 0.2), vec3(0.03, 0.2, 0.3), 0.5 + dot(slope, vec2(1.5)));
    vec3 tint = mix(deep, vec3(0.2, 0.56, 0.62), fresh / max(permanent + fresh, 1e-3));
    tint += vec3(0.75) * clamp(foam, 0.0, 1.0) * 0.55;
    diffuseColor.rgb = mix(diffuseColor.rgb, tint, waterAmount);
    waterGlint = pow(clamp(0.5 + dot(slope, vec2(1.6, 1.1)), 0.0, 1.0), 28.0) * 0.3 * detail * waterAmount;
  }
}
if (uAgriOn > 0.5 && waterAmount < 0.45) {
  float mark = texture(uAgri, vGridUv).r;
  if (mark > 0.002) {
    vec3 crop = mark > 0.006 ? vec3(0.996, 0.941, 0.541) : vec3(0.22, 0.72, 0.28);
    diffuseColor.rgb = mix(diffuseColor.rgb, crop, 0.82);
  }
}`,
			)
			.replace(
				"#include <roughnessmap_fragment>",
				`#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.18, waterAmount);`,
			)
			.replace(
				"#include <normal_fragment_maps>",
				`#include <normal_fragment_maps>
if (waterAmount > 0.001) {
  // superficie plana aunque el terreno de abajo esté deformado
  vec3 flatWater = normalize((viewMatrix * vec4(-waterSlope.x, 1.0, -waterSlope.y, 0.0)).xyz);
  normal = normalize(mix(normal, flatWater, min(waterAmount * 1.4, 1.0)));
}`,
			)
			.replace(
				"#include <emissivemap_fragment>",
				`#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.95, 0.82) * waterGlint;`,
			);
	};
	material.customProgramCacheKey = () => "terrain-layer-v10";
	return material;
}
