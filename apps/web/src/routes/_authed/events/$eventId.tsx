import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Event, EventPublished } from "@ticket-chain/shared";
import { api } from "@/lib/api";
import { eventDetailQuery } from "@/lib/queries";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function EventDetailsPage() {
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: event, isLoading, error } = useQuery(eventDetailQuery(eventId));
  const retryMinting = useMutation({
    mutationFn: () => api.retryMinting(eventId),
    onSuccess: async (updatedEvent) => {
      queryClient.setQueryData(["events", eventId], updatedEvent);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando evento…</div>;
  if (error || !event) return <div className="p-8 text-sm text-destructive">Não foi possível carregar este evento.</div>;

  const rules = buildRules(event);
  const totalTickets = event.status === "draft" ? event.tiers.reduce((sum, tier) => sum + tier.quantity, 0) : (event as EventPublished).totalSupply;
  const contractAddress = getContractAddress(event);

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/events" }, { label: "Eventos", to: "/events" }, { label: event.title }]} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
            <div className="flex flex-wrap gap-2"><StatusBadge status={event.status} /></div>
          </div>
          <p className="text-sm text-muted-foreground">{event.location} · {formatDate(event.startsAt)}</p>
        </div>
        <div className="flex gap-3"><Button variant="outline" disabled>Editar</Button><Button variant="ghost" disabled>Compartilhar</Button></div>
      </div>

      {event.status === "mint_failed" && (
        <Alert variant="error" title="Falha no mint" className="border border-error/20 bg-error/10 text-error-foreground">
          <div className="flex flex-col gap-3">
            <p>{(event as EventPublished).mintError ?? "O mint dos ingressos falhou."}</p>
            {retryMinting.error && <p className="text-sm">Não foi possível tentar novamente. Verifique sua conexão e tente de novo.</p>}
            <div className="flex gap-3"><Button onClick={() => retryMinting.mutate()} disabled={retryMinting.isPending}>{retryMinting.isPending ? "Tentando novamente…" : "Tentar novamente"}</Button><Button variant="outline" disabled>Cancelar mint</Button></div>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card><CardContent className="p-0"><div className="aspect-video bg-muted/30">{event.artworkUrl ? <img src={event.artworkUrl} alt={event.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem arte</div>}</div></CardContent></Card>

        <Card>
          <CardHeader><CardTitle>Configuração on-chain</CardTitle></CardHeader>
          <CardContent><dl className="grid gap-4 text-sm"><InfoRow label="Endereço do contrato" value={contractAddress || "Pendente"} mono /><InfoRow label="Total de ingressos" value={String(totalTickets)} /><InfoRow label="Padrão do ingresso" value={publishedValue(event, "tokenStandard", "Pendente")} /><InfoRow label="Código do evento" value={event.id} mono /><InfoRow label="Status do mint" value={statusLabel(event.status)} /><InfoRow label="Consulta local" value={contractAddress ? "Disponível no painel" : "Aguardando contrato"} /><InfoRow label="Consulta Amoy" value={contractAddress && event.status === "minted" ? "Disponível" : "Aguardando mint concluído"} /></dl></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Lotes de ingressos</CardTitle></CardHeader><CardContent className="p-0"><Table><THead><TR><TH>Setor</TH><TH>Preço original</TH><TH>Quantidade</TH></TR></THead><TBody>{event.tiers.map((tier) => <TR key={tier.id}><TD className="font-medium">{tier.name}</TD><TD>{formatCurrency(tier.faceValue)}</TD><TD>{tier.quantity}</TD></TR>)}</TBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Mercado secundário</CardTitle></CardHeader><CardContent className="flex flex-col gap-4 text-sm"><InfoRow label="Limite de revenda" value={`${rules.resaleCapPct}%`} /><InfoRow label="Repasse ao organizador" value={`${rules.royaltyPct}%`} /><InfoRow label="Marketplace obrigatório" value="Sim" /><p className="text-xs text-muted-foreground">As regras abaixo valem para todo o evento.</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Progresso do mint</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm"><TimelineItem done title="Evento criado" description="Cadastro do evento concluído." /><TimelineItem done={event.status !== "draft"} title="Configuração on-chain preparada" description="Padrão ERC-721 e regras aplicadas." /><TimelineItem done={event.status === "minted"} title="Ingressos mintados" description={event.status === "mint_failed" ? "Falha durante o mint." : "Ingressos prontos para validação."} /></CardContent>
        <CardFooter className="justify-end"><Link to="/events"><Button variant="outline">Voltar à lista</Button></Link></CardFooter>
      </Card>
    </div>
  );
}

function buildRules(event: Event): { resaleCapPct: number; royaltyPct: number } {
  const first = event.tiers[0];
  if (event.status === "draft") return { resaleCapPct: first?.resaleCapPct ?? 0, royaltyPct: first?.royaltyPct ?? 0 };
  return { resaleCapPct: (event as EventPublished).avgResaleCapPct, royaltyPct: (event as EventPublished).avgRoyaltyPct };
}

function publishedValue(event: Event, key: keyof EventPublished, fallback = "—"): string {
  return event.status === "draft" ? fallback : String((event as EventPublished)[key] ?? fallback);
}

function getContractAddress(event: Event): string {
  if (event.status === "draft") return "";
  return (event as EventPublished).contractAddress?.trim() ?? "";
}

function statusLabel(status: Event["status"]): string {
  return { draft: "Rascunho", published: "Publicado", minting: "Mint em andamento", minted: "Mint concluído", mint_failed: "Falha no mint" }[status];
}

function StatusBadge({ status }: { status: Event["status"] }) {
  const variant = status === "draft" ? "secondary" : status === "mint_failed" ? "destructive" : status === "minting" ? "warning" : "success";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex flex-col gap-1"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className={cn("font-medium text-foreground", mono && "font-mono")}>{value}</dd></div>;
}

function TimelineItem({ title, description, done }: { title: string; description: string; done: boolean }) {
  return <div className={cn("rounded-md border p-4", done ? "border-success/40 bg-success/10" : "border-border bg-background")}><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div>;
}

export const Route = createFileRoute("/_authed/events/$eventId")({ component: EventDetailsPage });
