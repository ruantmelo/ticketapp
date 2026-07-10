import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ticketDetailQuery } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TicketStatusBadge } from "@/components/buyer/ticket-status-badge";

const ROTATION_SECONDS = 10;

function TicketDetailPage() {
  const { ticketId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: ticket, isLoading, error } = useQuery(ticketDetailQuery(ticketId));
  const [listingOpen, setListingOpen] = React.useState(false);
  const [price, setPrice] = React.useState("");

  const listMutation = useMutation({
    mutationFn: (value: number) => api.createResaleListing(ticketId, value),
    onSuccess: async () => {
      setListingOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelResaleListing(ticketId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando ingresso…</div>;
  if (error || !ticket) return <div className="p-8 text-sm text-destructive">Não foi possível carregar este ingresso.</div>;

  // Must match the on-chain integer division (truncates), not round.
  const cap = Math.floor((ticket.faceValue * ticket.resaleCapPct) / 100);

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/marketplace" }, { label: "Meus ingressos", to: "/tickets" }, { label: ticket.eventTitle }]} />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{ticket.eventTitle}</h1>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground">{ticket.eventLocation} · {formatDate(ticket.eventStartsAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Ingresso digital</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <RotatingQrCode tokenId={ticket.tokenId} disabled={ticket.status !== "valid"} />
            <p className="text-xs text-muted-foreground">Setor {ticket.tierName} · Token {ticket.tokenId}</p>
            {ticket.status !== "valid" && (
              <p className="text-xs text-warning-foreground">
                {ticket.status === "listed" ? "Este ingresso está à venda e não pode ser usado para entrada." : "Este ingresso já foi utilizado."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenda</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <InfoRow label="Valor original" value={formatCurrency(ticket.faceValue)} />
            <InfoRow label="Limite de revenda" value={`${ticket.resaleCapPct}% (${formatCurrency(cap)})`} />
            {ticket.status === "listed" && ticket.listingPrice != null && (
              <InfoRow label="Preço anunciado" value={formatCurrency(ticket.listingPrice)} />
            )}

            {listingOpen && ticket.status === "valid" && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <Field
                  label="Preço de venda"
                  helper={`Máximo permitido: ${formatCurrency(cap)}`}
                  error={listMutation.error ? String((listMutation.error as { message?: string }).message ?? "Preço inválido") : undefined}
                >
                  <Input type="number" min={1} max={cap} value={price} onChange={(e) => setPrice(e.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setListingOpen(false)}>Cancelar</Button>
                  <Button onClick={() => listMutation.mutate(Number(price))} disabled={listMutation.isPending || !price}>
                    {listMutation.isPending ? "Publicando…" : "Confirmar anúncio"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-3">
            {ticket.status === "valid" && !listingOpen && (
              <Button variant="outline" onClick={() => setListingOpen(true)}>Colocar à venda</Button>
            )}
            {ticket.status === "listed" && (
              <Button variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? "Cancelando…" : "Cancelar anúncio"}
              </Button>
            )}
            <Link to="/tickets"><Button variant="ghost">Voltar</Button></Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function RotatingQrCode({ tokenId, disabled }: { tokenId: string; disabled?: boolean }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(ROTATION_SECONDS);

  React.useEffect(() => {
    if (disabled) return;

    let cancelled = false;

    async function render() {
      const now = Date.now();
      const window = Math.floor(now / (ROTATION_SECONDS * 1000));
      const payload = `ticket:${tokenId}:${window}`;
      const url = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
      if (!cancelled) setDataUrl(url);
      const elapsed = Math.floor((now / 1000) % ROTATION_SECONDS);
      setSecondsLeft(ROTATION_SECONDS - elapsed);
    }

    render();
    const interval = setInterval(render, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tokenId, disabled]);

  if (disabled) {
    return (
      <div className="flex h-60 w-60 items-center justify-center border border-border bg-muted/30 text-center text-sm text-muted-foreground">
        QR indisponível
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-60 w-60 items-center justify-center border border-border bg-background p-2">
        {dataUrl ? <img src={dataUrl} alt="QR code do ingresso" className="h-full w-full" /> : null}
      </div>
      <div className="flex w-full flex-col gap-1">
        <div className="h-1.5 w-60 overflow-hidden bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(secondsLeft / ROTATION_SECONDS) * 100}%` }}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">Atualiza em {secondsLeft}s</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export const Route = createFileRoute("/_authed/tickets/$ticketId")({ component: TicketDetailPage });
