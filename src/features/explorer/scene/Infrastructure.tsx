import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Segment } from "../lib/infrastructure";

const LIFT = 0.8;
const COLORS = {
	road: new THREE.Color("#e2e8f0"),
	canal: new THREE.Color("#38bdf8"),
	hit: new THREE.Color("#ff1744"),
};

interface InfrastructureProps {
	segments: Segment[];
	kind: "road" | "canal";
	flags: Uint8Array;
	heightAt: (col: number, row: number) => number;
}

/** Caminos o canales sobre el terreno; los tramos afectados se resaltan. */
export function Infrastructure({
	segments,
	kind,
	flags,
	heightAt,
}: InfrastructureProps) {
	const lines = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const mat = new THREE.LineBasicMaterial({ vertexColors: true });
		return new THREE.LineSegments(geo, mat);
	}, []);
	useEffect(
		() => () => {
			lines.geometry.dispose();
			(lines.material as THREE.Material).dispose();
		},
		[lines],
	);
	useEffect(() => {
		const pos = new Float32Array(segments.length * 6);
		const col = new Float32Array(segments.length * 6);
		segments.forEach((s, i) => {
			const c = flags[i] ? COLORS.hit : COLORS[kind];
			pos.set(
				[
					s.a[0],
					heightAt(s.a[0], s.a[1]) + LIFT,
					s.a[1],
					s.b[0],
					heightAt(s.b[0], s.b[1]) + LIFT,
					s.b[1],
				],
				i * 6,
			);
			col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
		});
		lines.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
		lines.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
		lines.geometry.computeBoundingSphere();
	}, [lines, segments, flags, kind, heightAt]);
	return <primitive object={lines} />;
}
