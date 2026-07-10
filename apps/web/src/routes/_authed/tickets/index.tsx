import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import type { OwnedTicket } from "@/lib/marketplace-types";
import { myTicketsQuery } from "@/lib/queries";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TicketStatusBadge } from "@/components/buyer/ticket-status-badge";
import { formatCurrency, formatDateShort } from "@/lib/utils";

function MyTicketsPage() {
  const { data, isLoading, error } = useQuery(myTicketsQuery);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/marketplace" }, { label: "Meus ingressos" }]} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Meus ingressos</h1>
        <p className="text-sm text-muted-foreground">{items.length} ingresso{items.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando ingressos…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar seus ingressos.</p>}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">Você ainda não possui ingressos.</p>
          <Link to="/marketplace"><Badge variant="outline">Explorar marketplace</Badge></Link>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: OwnedTicket }) {
  return (
    <Link to="/tickets/$ticketId" params={{ ticketId: ticket.id }}>
      <Card className="flex h-full flex-col transition-colors hover:border-primary">
        <div className="flex aspect-video items-center justify-center bg-muted/30">
          {ticket.artworkUrl ? (
            <img src={ticket.artworkUrl} alt={ticket.eventTitle} className="h-full w-full object-cover" />
          ) : (
            <Ticket className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-medium text-foreground">{ticket.eventTitle}</h2>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground">{ticket.tierName} · {formatDateShort(ticket.eventStartsAt)}</p>
          <p className="mt-auto text-sm font-medium text-foreground">{formatCurrency(ticket.faceValue)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export const Route = createFileRoute("/_authed/tickets/")({ component: MyTicketsPage });
