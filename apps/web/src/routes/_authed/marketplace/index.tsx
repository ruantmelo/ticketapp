import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Ticket } from "lucide-react";
import type { MarketplaceEvent } from "@/lib/marketplace-types";
import { marketplaceEventsQuery } from "@/lib/queries";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/lib/utils";

function MarketplacePage() {
  const { data, isLoading, error } = useQuery(marketplaceEventsQuery);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/marketplace" }, { label: "Marketplace" }]} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
        <p className="text-sm text-muted-foreground">Explore eventos e compre ingressos com garantia de autenticidade.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando eventos…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar o marketplace.</p>}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">Nenhum evento disponível no momento.</p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: MarketplaceEvent }) {
  const values = event.tiers.map((t) => t.faceValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const priceLabel = min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;

  return (
    <Link to="/marketplace/$eventId" params={{ eventId: event.id }}>
      <Card className="flex h-full flex-col transition-colors hover:border-primary">
        <div className="flex aspect-video items-center justify-center bg-muted/30">
          {event.artworkUrl ? (
            <img src={event.artworkUrl} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <Ticket className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <CardContent className="flex flex-1 flex-col gap-2">
          <h2 className="font-medium text-foreground">{event.title}</h2>
          <p className="text-sm text-muted-foreground">{event.location}</p>
          <p className="text-sm text-muted-foreground">{formatDateShort(event.startsAt)}</p>
          <p className="mt-auto text-sm font-medium text-foreground">A partir de {priceLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export const Route = createFileRoute("/_authed/marketplace/")({ component: MarketplacePage });
