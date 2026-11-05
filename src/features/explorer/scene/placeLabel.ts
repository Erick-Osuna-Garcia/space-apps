import type * as THREE from "three";

/** Coloca una etiqueta DOM sobre un punto de la escena; la oculta si queda fuera de la vista. */
export function placeLabel(
	el: HTMLElement,
	point: THREE.Vector3,
	camera: THREE.Camera,
	size: { width: number; height: number },
) {
	point.project(camera);
	const inView = Math.abs(point.x) < 1.05 && Math.abs(point.y) < 1.05;
	el.style.visibility = inView ? "visible" : "hidden";
	if (!inView) return;
	const x = ((point.x + 1) / 2) * size.width;
	const y = ((1 - point.y) / 2) * size.height;
	el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
}
