interface DateTitleProps {
	date: string;
	subtitle: string;
	/** En reproducción no se anuncia cada fecha a los lectores de pantalla. */
	announce: boolean;
}

/** Fecha como título grande de juego, justo encima de la línea de tiempo. */
export function DateTitle({ date, subtitle, announce }: DateTitleProps) {
	return (
		<div
			// la clave reinicia la animación de entrada con cada fecha
			key={date}
			aria-live={announce ? "polite" : "off"}
			className="date-title pointer-events-none text-center"
		>
			<p className="date-title-main text-4xl sm:text-6xl">{date}</p>
			<p className="date-title-sub mt-1 text-base sm:text-xl">{subtitle}</p>
		</div>
	);
}
