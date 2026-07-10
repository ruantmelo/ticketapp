import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Copy, CreditCard, QrCode } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CheckoutStepIndicator, type CheckoutStep } from "@/components/buyer/checkout-step-indicator";
import { api } from "@/lib/api";
import { marketplaceEventQuery, resaleListingsQuery } from "@/lib/queries";
import { cn, formatCurrency } from "@/lib/utils";

interface CheckoutSearch {
  tierId?: string;
  listingId?: string;
  step: CheckoutStep;
}

function CheckoutPage() {
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = React.useState<"pix" | "card">("pix");
  const [purchasedTicketId, setPurchasedTicketId] = React.useState<string | null>(null);

  const { data: event, isLoading, error } = useQuery(marketplaceEventQuery(eventId));
  const { data: listingsData } = useQuery(resaleListingsQuery(eventId));

  const tier = event?.tiers.find((t) => t.id === search.tierId);
  const listing = listingsData?.items.find((l) => l.id === search.listingId);
  const label = tier?.name ?? listing?.tierName ?? "";
  const price = tier?.faceValue ?? listing?.price ?? 0;

  const purchase = useMutation({
    mutationFn: async () => {
      if (search.listingId) return api.buySecondaryListing(search.listingId);
      if (search.tierId) return api.buyPrimaryTicket(eventId, search.tierId);
      throw { code: "invalid", message: "Selecione um ingresso" };
    },
    onSuccess: async (ticket) => {
      setPurchasedTicketId(ticket.id);
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      goTo("confirmacao");
    },
  });

  function goTo(step: CheckoutStep) {
    navigate({ search: { ...search, step } });
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (error || !event) return <div className="p-8 text-sm text-destructive">Não foi possível carregar este evento.</div>;

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/marketplace" },
          { label: event.title, to: `/marketplace/${event.id}` },
          { label: "Checkout" },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Finalizar compra</h1>
        <p className="text-sm text-muted-foreground">{event.title} · {label}</p>
      </div>

      <CheckoutStepIndicator current={search.step} />

      {search.step === "revisao" && (
        <Card className="max-w-xl">
          <CardHeader><CardTitle>Resumo do pedido</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <SummaryRow label="Evento" value={event.title} />
            <SummaryRow label="Setor" value={label} />
            <SummaryRow label="Quantidade" value="1" />
            <SummaryRow label="Total" value={formatCurrency(price)} bold />
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => goTo("pagamento")}>Continuar</Button>
          </CardFooter>
        </Card>
      )}

      {search.step === "pagamento" && (
        <Card className="max-w-xl">
          <CardHeader><CardTitle>Forma de pagamento</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex gap-3">
              <Button
                type="button"
                variant={paymentMethod === "pix" ? "default" : "outline"}
                onClick={() => setPaymentMethod("pix")}
              >
                <QrCode className="h-4 w-4" />Pix
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="h-4 w-4" />Cartão
              </Button>
            </div>

            {paymentMethod === "pix" ? (
              <div className="flex flex-col items-center gap-3 border border-dashed border-border p-6">
                <div className="flex h-40 w-40 items-center justify-center border border-border bg-muted/30">
                  <QrCode className="h-20 w-20 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Escaneie o QR code com o app do seu banco</p>
                <div className="flex w-full items-center gap-2 border border-border bg-muted/30 px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs text-muted-foreground">00020126580014BR.GOV.BCB.PIX0136fake-pix-code-{event.id}</span>
                  <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Número do cartão"><Input placeholder="0000 0000 0000 0000" /></Field>
                <div className="flex gap-3">
                  <Field label="Validade" className="flex-1"><Input placeholder="MM/AA" /></Field>
                  <Field label="CVV" className="w-24"><Input placeholder="123" /></Field>
                </div>
                <Field label="Nome no cartão"><Input placeholder="Como está impresso no cartão" /></Field>
              </div>
            )}

            {purchase.error && <p className="text-sm text-destructive">Não foi possível concluir o pagamento. Tente novamente.</p>}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => goTo("revisao")}>Voltar</Button>
            <Button onClick={() => purchase.mutate()} disabled={purchase.isPending}>
              {purchase.isPending ? "Processando…" : `Pagar ${formatCurrency(price)}`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {search.step === "confirmacao" && (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <CircleCheck className="h-12 w-12 text-success" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-medium text-foreground">Pagamento confirmado!</h2>
              <p className="text-sm text-muted-foreground">Seu ingresso já está disponível na área "Meus ingressos".</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center gap-3">
            <Link to="/marketplace"><Button variant="outline">Voltar ao marketplace</Button></Link>
            {purchasedTicketId && (
              <Link to="/tickets/$ticketId" params={{ ticketId: purchasedTicketId }}>
                <Button>Ver meu ingresso</Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", bold && "text-base font-semibold")}>{value}</span>
    </div>
  );
}

export const Route = createFileRoute("/_authed/checkout/$eventId")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    tierId: typeof search.tierId === "string" ? search.tierId : undefined,
    listingId: typeof search.listingId === "string" ? search.listingId : undefined,
    step: search.step === "pagamento" || search.step === "confirmacao" ? search.step : "revisao",
  }),
  component: CheckoutPage,
});
