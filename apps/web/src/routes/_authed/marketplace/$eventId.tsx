import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { marketplaceEventQuery, resaleListingsQuery } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

function EventMarketplacePage() {
  const { eventId } = Route.useParams();
  const { data: event, isLoading, error } = useQuery(marketplaceEventQuery(eventId));
  const { data: listingsData } = useQuery(resaleListingsQuery(eventId));
  const listings = listingsData?.items ?? [];

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando evento…</div>;
  if (error || !event) return <div className="p-8 text-sm text-destructive">Não foi possível carregar este evento.</div>;

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/marketplace" }, { label: "Marketplace", to: "/marketplace" }, { label: event.title }]} />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
        <p className="text-sm text-muted-foreground">{event.organizerName} · {event.location} · {formatDate(event.startsAt)}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex aspect-[3/1] items-center justify-center bg-muted/30">
            {event.artworkUrl ? (
              <img src={event.artworkUrl} alt={event.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem arte</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ingressos oficiais</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Setor</TH><TH>Preço</TH><TH>Disponíveis</TH><TH className="w-32">Ações</TH></TR></THead>
            <TBody>
              {event.tiers.map((tier) => (
                <TR key={tier.id}>
                  <TD className="font-medium text-foreground">{tier.name}</TD>
                  <TD>{formatCurrency(tier.faceValue)}</TD>
                  <TD className="text-muted-foreground">{tier.available > 0 ? tier.available : <Badge variant="destructive">Esgotado</Badge>}</TD>
                  <TD>
                    <Link to="/checkout/$eventId" params={{ eventId: event.id }} search={{ tierId: tier.id, step: "revisao" }}>
                      <Button size="sm" disabled={tier.available <= 0}>Comprar</Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Revenda disponível</CardTitle></CardHeader>
        <CardContent className="p-0">
          {listings.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum ingresso de revenda disponível para este evento.</p>
          ) : (
            <Table>
              <THead><TR><TH>Setor</TH><TH>Valor original</TH><TH>Preço de revenda</TH><TH>Vendedor</TH><TH className="w-32">Ações</TH></TR></THead>
              <TBody>
                {listings.map((listing) => (
                  <TR key={listing.id}>
                    <TD className="font-medium text-foreground">{listing.tierName}</TD>
                    <TD className="text-muted-foreground">{formatCurrency(listing.faceValue)}</TD>
                    <TD>{formatCurrency(listing.price)}</TD>
                    <TD className="text-muted-foreground">{listing.sellerName}</TD>
                    <TD>
                      {listing.isOwn ? (
                        <Badge variant="outline">Seu anúncio</Badge>
                      ) : (
                        <Link to="/checkout/$eventId" params={{ eventId: event.id }} search={{ listingId: listing.id, step: "revisao" }}>
                          <Button size="sm">Comprar</Button>
                        </Link>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authed/marketplace/$eventId")({ component: EventMarketplacePage });
