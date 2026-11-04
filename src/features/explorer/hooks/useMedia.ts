import { useEffect, useState } from "react";

function useMediaQuery(query: string, fallback = false) {
	const [matches, setMatches] = useState(() =>
		typeof window === "undefined" ? fallback : window.matchMedia(query).matches,
	);
	useEffect(() => {
		const mql = window.matchMedia(query);
		const onChange = () => setMatches(mql.matches);
		onChange();
		mql.addEventListener("change", onChange);
		return () => mql.removeEventListener("change", onChange);
	}, [query]);
	return matches;
}

export const usePrefersReducedMotion = () =>
	useMediaQuery("(prefers-reduced-motion: reduce)");

/** Pantallas táctiles o pequeñas: terreno decimado y UI compacta. */
export const useIsCompact = () =>
	useMediaQuery("(max-width: 767px), (pointer: coarse)");

export function hasWebGL2(): boolean {
	try {
		const canvas = document.createElement("canvas");
		return Boolean(canvas.getContext("webgl2"));
	} catch {
		return false;
	}
}
