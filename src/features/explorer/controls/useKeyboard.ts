import { useEffect, useRef } from "react";

export interface KeyAxes {
	right: number;
	forward: number;
	boost: boolean;
}

const RIGHT = new Set(["KeyD", "ArrowRight"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const UP = new Set(["KeyW", "ArrowUp"]);
const DOWN = new Set(["KeyS", "ArrowDown"]);
const ARROWS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]);

/** `code` físico (WASD funciona igual en AZERTY); si el evento no lo trae, se deriva de `key`. */
function keyCode(e: KeyboardEvent): string {
	if (e.code) return e.code;
	if (e.key.startsWith("Arrow")) return e.key;
	return e.key.length === 1 ? `Key${e.key.toUpperCase()}` : e.key;
}

function isTyping(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;
	// los sliders (role=slider) usan las flechas: no pilotar mientras tienen el foco
	return (
		target.isContentEditable ||
		["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
		target.getAttribute("role") === "slider"
	);
}

/** Teclas de pilotaje (WASD / flechas, Shift = turbo). Devuelve un ref leído en `useFrame`. */
export function useKeyboard() {
	const pressed = useRef(new Set<string>());
	const axes = useRef<KeyAxes>({ right: 0, forward: 0, boost: false });

	useEffect(() => {
		const keys = pressed.current;
		const update = (e?: KeyboardEvent) => {
			const has = (set: Set<string>) => [...set].some((k) => keys.has(k));
			axes.current = {
				right: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
				forward: (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0),
				boost: e?.shiftKey ?? false,
			};
		};
		const down = (e: KeyboardEvent) => {
			if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
			const code = keyCode(e);
			if (ARROWS.has(code)) e.preventDefault();
			keys.add(code);
			update(e);
		};
		const up = (e: KeyboardEvent) => {
			keys.delete(keyCode(e));
			update(e);
		};
		const clear = () => {
			keys.clear();
			update();
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", clear);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", clear);
		};
	}, []);

	return axes;
}
