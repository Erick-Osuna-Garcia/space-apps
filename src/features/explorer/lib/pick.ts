export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/**
 * Punto del terreno bajo un rayo de la cámara ortográfica, recorriendo el heightmap.
 * Mucho más barato que un raycast contra ~500 mil triángulos (que congelaba el zoom).
 */
export function pickTerrain(
	origin: Vec3,
	dir: Vec3,
	heightAt: (col: number, row: number) => number,
	width: number,
	height: number,
	maxT: number,
): { col: number; row: number } | null {
	const step = 0.75;
	let prevT = 0;
	for (let t = 0; t <= maxT; t += step) {
		const x = origin.x + dir.x * t;
		const z = origin.z + dir.z * t;
		const y = origin.y + dir.y * t;
		const inside = x >= 0 && z >= 0 && x <= width && z <= height;
		if (inside && y <= heightAt(x, z)) {
			// refinamiento por bisección entre el paso anterior y este
			let lo = prevT;
			let hi = t;
			for (let i = 0; i < 12; i++) {
				const mid = (lo + hi) / 2;
				const my = origin.y + dir.y * mid;
				if (my <= heightAt(origin.x + dir.x * mid, origin.z + dir.z * mid))
					hi = mid;
				else lo = mid;
			}
			return { col: origin.x + dir.x * hi, row: origin.z + dir.z * hi };
		}
		prevT = t;
	}
	return null;
}
