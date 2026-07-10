import type { OwnedTicket } from "@/lib/marketplace-types";
import { Badge } from "@/components/ui/badge";

export function TicketStatusBadge({ status }: { status: OwnedTicket["status"] }) {
  const map = {
    valid: { variant: "success" as const, label: "Válido" },
    listed: { variant: "warning" as const, label: "À venda" },
    used: { variant: "secondary" as const, label: "Usado" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
