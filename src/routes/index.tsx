import { createFileRoute } from "@tanstack/react-router";
import { Explorer, ExplorerLoading } from "#/features/explorer/Explorer";

// WebGL no corre en el servidor: la escena se monta solo en el cliente (design.md D10).
export const Route = createFileRoute("/")({
	ssr: false,
	component: Explorer,
	pendingComponent: () => <ExplorerLoading />,
});
