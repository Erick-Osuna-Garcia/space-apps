/** Traducciones de los datos a lenguaje cotidiano (design.md D14). Solo lógica pura. */
import type { Poi } from "../manifest";

export type TrendLevel =
	| "none"
	| "stable"
	| "slow"
	| "moderate"
	| "fast"
	| "toward";

export const TREND_LABELS: Record<TrendLevel, string> = {
	none: "Sin lectura",
	stable: "Estable",
	slow: "Se hunde lento",
	moderate: "Se hunde moderado",
	fast: "Se hunde rápido",
	toward: "Se acerca al satélite",
};

/** Nivel orientativo según la tendencia en cm/año. No es una evaluación de riesgo. */
export function trendLevel(rate: number | null): TrendLevel {
	if (rate === null || !Number.isFinite(rate)) return "none";
	if (Math.abs(rate) < 1) return "stable";
	if (rate > 0) return "toward";
	if (rate > -3) return "slow";
	if (rate > -8) return "moderate";
	return "fast";
}

const OBJECTS: Array<[number, string]> = [
	[0.5, "menos que el grosor de un lápiz"],
	[3, "como una moneda"],
	[11, "como una tarjeta bancaria"],
	[24, "como un lápiz"],
	[40, "como una regla escolar"],
];

/** Comparación de una magnitud en cm con un objeto; null si es despreciable. */
export function sizeComparison(cm: number | null): string | null {
	if (cm === null) return null;
	const abs = Math.abs(cm);
	if (abs < 0.1) return null;
	const match = OBJECTS.find(([limit]) => abs <= limit);
	return match ? match[1] : "más que una regla escolar";
}

const SOCCER_FIELD_KM2 = (105 * 68) / 1e6;

function twoSignificant(v: number): number {
	const magnitude = 10 ** (Math.floor(Math.log10(v)) - 1);
	return Math.round(v / magnitude) * magnitude;
}

/** Área expresada en canchas de fútbol (aproximada); null si no hay área. */
export function areaComparison(km2: number): string | null {
	if (km2 <= 0) return null;
	const fields = km2 / SOCCER_FIELD_KM2;
	if (fields < 1) return "≈ menos de una cancha de fútbol";
	const rounded = fields < 10 ? Math.round(fields) : twoSignificant(fields);
	const text = rounded.toLocaleString("en-US");
	return `≈ ${text} ${rounded === 1 ? "cancha" : "canchas"} de fútbol`;
}

/** Punto de interés más cercano y frase para mostrarlo. */
export function nearestPoi(
	pois: Poi[],
	col: number,
	row: number,
	cellSizeM: number,
): { poi: Poi; km: number; text: string } | null {
	let best: Poi | null = null;
	let bestDist = Number.POSITIVE_INFINITY;
	for (const poi of pois) {
		const d = Math.hypot(poi.col - col, poi.row - row);
		if (d < bestDist) {
			bestDist = d;
			best = poi;
		}
	}
	if (!best) return null;
	const km = (bestDist * cellSizeM) / 1000;
	const text =
		km < 1 ? `Sobre ${best.name}` : `A ${km.toFixed(1)} km de ${best.name}`;
	return { poi: best, km, text };
}

/** Tiempo entre dos fechas ISO en palabras. */
export function elapsedText(first: string, current: string): string {
	const days = Math.round(
		(Date.parse(current) - Date.parse(first)) / 86_400_000,
	);
	if (days <= 0) return "Fecha inicial";
	if (days < 45)
		return `${days} ${days === 1 ? "día" : "días"} desde el inicio`;
	const months = Math.round(days / 30.44);
	if (months < 12) return `${months} meses desde el inicio`;
	const years = Math.floor(months / 12);
	const rest = months % 12;
	const y = `${years} ${years === 1 ? "año" : "años"}`;
	if (rest === 0) return `${y} desde el inicio`;
	return `${y} y ${rest} ${rest === 1 ? "mes" : "meses"} desde el inicio`;
}
