import { cn } from "cn";

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/75 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-md",
				className,
			)}
			{...props}
		/>
	);
}

export function PanelTitle({
	className,
	...props
}: React.ComponentProps<"h2">) {
	return (
		<h2
			className={cn(
				"text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-400",
				className,
			)}
			{...props}
		/>
	);
}
