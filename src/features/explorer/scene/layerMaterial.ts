import * as THREE from "three";
import { colormapLut } from "../lib/colormap";

export const NODATA_SENTINEL = -9999;

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
	/** 0 = acumulado (cubo por fecha), 1 = velocidad (cm/año). */
	uMode: { value: number };
	uVelocity: { value: THREE.DataTexture };
	uVelLimit: { value: number };
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

/** Campo de velocidad (cm/año, NaN = sin dato) como textura 2D. */
export function velocityTexture(
	velocity: Float32Array,
	width: number,
	height: number,
) {
	const data = new Float32Array(velocity.length);
	for (let k = 0; k < velocity.length; k++) {
		const v = velocity[k];
		data[k] = Number.isFinite(v) ? v : NODATA_SENTINEL;
	}
	return floatTexture(data, width, height);
}

function lutTexture() {
	const t = new THREE.DataTexture(colormapLut(256), 256, 1, THREE.RGBAFormat);
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
		uVelocity: { value: floatTexture(new Float32Array([0]), 1, 1) },
		uVelLimit: { value: 10 },
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
uniform sampler2D uVelocity;
uniform float uDateA, uDateB, uMix, uOpacity, uLimit, uLayerOn, uMode, uVelLimit;
uniform vec3 uNoData;
varying vec2 vGridUv;`,
			)
			.replace(
				"#include <color_fragment>",
				`#include <color_fragment>
if (uLayerOn > 0.5) {
  vec3 layerColor;
  float v;
  float limit;
  bool nodata;
  if (uMode > 0.5) {
    v = texture(uVelocity, vGridUv).r;
    limit = uVelLimit;
    nodata = v < ${NODATA_SENTINEL.toFixed(1)} + 1.0;
  } else {
    float a = texture(uCube, vec3(vGridUv, uDateA)).r;
    float b = texture(uCube, vec3(vGridUv, uDateB)).r;
    v = mix(a, b, uMix);
    limit = uLimit;
    nodata = a < ${NODATA_SENTINEL.toFixed(1)} + 1.0 || b < ${NODATA_SENTINEL.toFixed(1)} + 1.0;
  }
  if (nodata) {
    layerColor = uNoData;
  } else {
    float t = clamp(0.5 - v / (2.0 * limit), 0.0, 1.0);
    layerColor = texture(uLut, vec2(t, 0.5)).rgb;
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, layerColor, uOpacity);
}`,
			);
	};
	material.customProgramCacheKey = () => "terrain-layer-v3";
	return material;
}
