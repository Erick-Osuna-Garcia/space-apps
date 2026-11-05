import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Feature } from "../lib/infrastructure";
import { buildRibbon, ROAD_STYLES, ribbonHits } from "../lib/ribbon";
import type { LayerUniforms } from "./layerMaterial";

const LIFT = 0.12;
const MIN_WIDTH_PX = 1.6;
const CASING_PX = 1.2;
const NEVER_HIDES = 1e9;
const CASING_COLORS = { road: "#1e293b", canal: "#0c2a44" };

const VERTEX = /* glsl */ `
precision highp sampler2DArray;
attribute vec2 aSide;
attribute float aClass, aAlong, aHit;
uniform sampler2DArray uDeformCube;
uniform float uDateA, uDateB, uMix, uDeform;
uniform vec2 uTexel;
uniform float uHalfWidths[${ROAD_STYLES.length}];
uniform float uMaxCells[${ROAD_STYLES.length}];
uniform vec3 uColors[${ROAD_STYLES.length}];
uniform float uUnitsPerPx, uVisibleCells, uMinWidthPx, uCasingPx, uLift;
varying vec3 vColor;
varying float vFade, vHit, vAlong;

float dispCell(vec2 cell) {
  vec2 uv = (cell + 0.5) * uTexel;
  return mix(
    texture(uDeformCube, vec3(uv, uDateA)).r,
    texture(uDeformCube, vec3(uv, uDateB)).r,
    uMix
  );
}

// el cubo no se interpola: entre celdas se calcula igual que la malla del terreno
float dispAt(vec2 p) {
  vec2 q = p - 0.5; // el centro de la celda i está en i + 0.5
  vec2 cell = floor(q);
  vec2 f = q - cell;
  return mix(
    mix(dispCell(cell), dispCell(cell + vec2(1.0, 0.0)), f.x),
    mix(dispCell(cell + vec2(0.0, 1.0)), dispCell(cell + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  int cls = int(aClass + 0.5);
  float halfWidth = max(uHalfWidths[cls], uMinWidthPx * 0.5 * uUnitsPerPx);
  halfWidth = halfWidth * mix(1.0, 1.25, aHit) + uCasingPx * uUnitsPerPx;
  vec3 p = position;
  p.xz += aSide * halfWidth;
  p.y += uLift;
  if (uDeform > 0.0) p.y += dispAt(p.xz) * uDeform;
  float maxCells = uMaxCells[cls];
  vFade = max(aHit, 1.0 - smoothstep(maxCells * 0.8, maxCells, uVisibleCells));
  vColor = uColors[cls];
  vHit = aHit;
  vAlong = aAlong;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform float uCasing, uFlow, uTime;
uniform vec3 uHitColor, uCasingColor;
varying vec3 vColor;
varying float vFade, vHit, vAlong;

void main() {
  if (vFade < 0.01) discard;
  vec3 color = mix(vColor, uHitColor, vHit);
  // brillo que avanza por el canal
  float flow = smoothstep(0.6, 1.0, sin(vAlong * 0.9 - uTime * 2.2));
  color += vec3(0.35) * flow * uFlow * (1.0 - vHit);
  gl_FragColor = vec4(mix(color, uCasingColor, uCasing), vFade);
  #include <colorspace_fragment>
}`;

function ribbonMaterial(
	terrain: LayerUniforms,
	kind: "road" | "canal",
	casing: boolean,
	shared: {
		uUnitsPerPx: { value: number };
		uVisibleCells: { value: number };
	},
) {
	return new THREE.ShaderMaterial({
		vertexShader: VERTEX,
		fragmentShader: FRAGMENT,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -8,
		uniforms: {
			// por referencia: se mueven igual que el terreno
			uDeformCube: terrain.uDeformCube,
			uDateA: terrain.uDateA,
			uDateB: terrain.uDateB,
			uMix: terrain.uMix,
			uDeform: terrain.uDeform,
			uTexel: terrain.uTexel,
			uTime: terrain.uTime,
			...shared,
			uHalfWidths: { value: ROAD_STYLES.map((s) => s.halfWidth) },
			uMaxCells: {
				value: ROAD_STYLES.map((s) => Math.min(s.maxCells, NEVER_HIDES)),
			},
			uColors: { value: ROAD_STYLES.map((s) => new THREE.Color(s.color)) },
			uMinWidthPx: { value: MIN_WIDTH_PX },
			uCasingPx: { value: casing ? CASING_PX : 0 },
			uLift: { value: LIFT },
			uCasing: { value: casing ? 1 : 0 },
			uFlow: { value: kind === "canal" ? 1 : 0 },
			uHitColor: { value: new THREE.Color("#ff1744") },
			uCasingColor: { value: new THREE.Color(CASING_COLORS[kind]) },
		},
	});
}

interface InfrastructureProps {
	features: Feature[];
	kind: "road" | "canal";
	flags: Uint8Array;
	baseHeightAt: (col: number, row: number) => number;
	terrain: LayerUniforms;
}

/** Caminos o canales como cintas sobre el terreno; los tramos afectados se resaltan. */
export function Infrastructure({
	features,
	kind,
	flags,
	baseHeightAt,
	terrain,
}: InfrastructureProps) {
	const ribbon = useMemo(
		() => buildRibbon(features, baseHeightAt),
		[features, baseHeightAt],
	);
	const geometry = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const attr = (data: Float32Array, size: number) =>
			new THREE.BufferAttribute(data, size);
		geo.setAttribute("position", attr(ribbon.position, 3));
		geo.setAttribute("aSide", attr(ribbon.side, 2));
		geo.setAttribute("aClass", attr(ribbon.cls, 1));
		geo.setAttribute("aAlong", attr(ribbon.along, 1));
		geo.setAttribute("aHit", attr(new Float32Array(ribbon.segment.length), 1));
		geo.setIndex(new THREE.BufferAttribute(ribbon.index, 1));
		return geo;
	}, [ribbon]);
	useEffect(() => () => geometry.dispose(), [geometry]);

	useEffect(() => {
		const hit = geometry.getAttribute("aHit") as THREE.BufferAttribute;
		hit.copyArray(ribbonHits(ribbon.segment, flags));
		hit.needsUpdate = true;
	}, [geometry, ribbon, flags]);

	const view = useMemo(
		() => ({ uUnitsPerPx: { value: 1 }, uVisibleCells: { value: 1 } }),
		[],
	);
	const materials = useMemo(
		() => ({
			casing: ribbonMaterial(terrain, kind, true, view),
			fill: ribbonMaterial(terrain, kind, false, view),
		}),
		[terrain, kind, view],
	);
	useEffect(
		() => () => {
			materials.casing.dispose();
			materials.fill.dispose();
		},
		[materials],
	);

	useFrame(({ camera, size }) => {
		const { zoom } = camera as THREE.OrthographicCamera;
		view.uUnitsPerPx.value = 1 / zoom;
		view.uVisibleCells.value = size.width / zoom;
	});

	// el borde se dibuja antes para que los cruces se vean limpios
	const order = kind === "canal" ? 1 : 3;
	return (
		<>
			<mesh
				geometry={geometry}
				material={materials.casing}
				renderOrder={order}
				frustumCulled={false}
				raycast={noRaycast}
			/>
			<mesh
				geometry={geometry}
				material={materials.fill}
				renderOrder={order + 1}
				frustumCulled={false}
				raycast={noRaycast}
			/>
		</>
	);
}

const noRaycast = () => null;
