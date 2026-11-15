import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";

type ScienceDisclosureProps = {
	title: string;
	summary?: string;
	heading?: "h3" | "h4";
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
};

const triggerClass =
	"flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-start text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-300 motion-safe:transition-[transform,color,background-color] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)] motion-safe:active:scale-[0.96] sm:min-h-10";

export const ScienceDisclosure = ({
	title,
	summary,
	heading = "h3",
	open,
	defaultOpen,
	onOpenChange,
	children,
}: ScienceDisclosureProps) => {
	const Heading = heading;
	return (
		<Collapsible.Root
			className="group"
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
		>
			<Heading className="m-0 w-full text-sm font-semibold leading-[1.1]">
				<Collapsible.Trigger className={triggerClass}>
					<span className="min-w-0 flex-1 text-pretty text-start text-white [text-wrap:balance]">
						{title}
						{summary ? (
							<span className="mt-0.5 block font-normal text-slate-300 text-sm tabular-nums">
								{summary}
							</span>
						) : null}
					</span>
					<ChevronDown
						className="science-chevron size-4 shrink-0 stroke-[2] text-current group-data-[state=open]:rotate-180"
						aria-hidden
					/>
				</Collapsible.Trigger>
			</Heading>
			<Collapsible.Content className="overflow-hidden data-[state=open]:pt-2">
				{children}
			</Collapsible.Content>
		</Collapsible.Root>
	);
};

export const ScienceFields = ({
	fields,
}: {
	fields: Array<{ label: string; value: string }>;
}) => (
	<dl className="grid gap-2">
		{fields.map((field) => (
			<div key={field.label} className="flex justify-between gap-3">
				<dt className="text-[0.75rem] font-medium uppercase tracking-wider text-slate-300">
					{field.label}
				</dt>
				<dd className="max-w-[65ch] text-end text-sm leading-[1.5] text-slate-100 text-pretty tabular-nums [overflow-wrap:break-word]">
					{field.value}
				</dd>
			</div>
		))}
	</dl>
);

export const ScienceStatus = ({
	children,
	tone = "neutral",
}: {
	children: React.ReactNode;
	tone?: "neutral" | "warn";
}) => (
	<output
		className={cn(
			"block text-pretty text-base leading-[1.5] [text-wrap:pretty]",
			tone === "warn" ? "text-amber-200" : "text-slate-200",
		)}
	>
		{children}
	</output>
);
