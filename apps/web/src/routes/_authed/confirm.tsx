import * as React from "react";
import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Share2, PlusCircle, LayoutDashboard } from "lucide-react";
import type { EventPublished } from "@ticket-chain/shared";
import { eventDetailQuery } from "@/lib/queries";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";

interface ConfirmSearch { id: string; }

function ConfirmationPage() {
  const search = useSearch({ from: "/_authed/confirm" }) as ConfirmSearch;
  const navigate = useNavigate();
  const { data: event, isLoading, error } = useQuery(eventDetailQuery(search.id));
  const published = event && event.status !== "draft" ? (event as EventPublished) : null;

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted-foreground">Carregando…</p></div>;
  if (error || !published) return <div className="flex min-h-screen flex-col items-center justify-center gap-4"><p className="text-sm text-destructive">Evento ainda não foi publicado.</p><Link to="/events"><Button variant="outline">Voltar ao painel</Button></Link></div>;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-background px-4 pt-[100px]">
      <Alert variant="success" title="Evento criado com sucesso!" className="w-full max-w-[560px]">Seus ingressos estão sendo mintados na blockchain. Você acompanhará o progresso no painel.</Alert>
      <div className="flex w-full max-w-[560px] flex-col gap-6">
        <Card><CardContent className="flex flex-col gap-4 p-6"><div className="flex gap-6"><div className="w-[200px] shrink-0 overflow-hidden border border-border bg-muted/30">{published.artworkUrl ? <img src={published.artworkUrl} alt={published.title} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">Sem arte</div>}</div><div className="flex flex-1 flex-col gap-2"><h2 className="text-xl font-bold text-foreground">{published.title}</h2><dl className="flex flex-col gap-1.5 text-sm"><div className="flex gap-2"><dt className="text-muted-foreground">Data:</dt><dd className="font-medium text-foreground">{formatDate(published.startsAt)}</dd></div><div className="flex gap-2"><dt className="text-muted-foreground">Local:</dt><dd className="font-medium text-foreground">{published.location}</dd></div><div className="flex gap-2"><dt className="text-muted-foreground">Capacidade:</dt><dd className="font-medium text-foreground">{published.capacity}</dd></div></dl></div></div><div className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-medium text-foreground">Parâmetros on-chain</h3><dl className="grid grid-cols-2 gap-x-8 gap-y-3"><ParamRow label="Padrão de token" value={published.tokenStandard} mono /><ParamRow label="Endereço do contrato" value={shortAddr(published.contractAddress)} mono /><ParamRow label="Supply total" value={String(published.totalSupply)} /><ParamRow label="Cap de revenda médio" value={`${published.avgResaleCapPct}%`} /><ParamRow label="Royalty média" value={`${published.avgRoyaltyPct}%`} /></dl></div></CardContent></Card>
        <div className="flex items-center gap-3"><Link to="/events"><Button><LayoutDashboard className="h-4 w-4" />Ver no painel</Button></Link><Button variant="outline" onClick={() => void share(published.title)}><Share2 className="h-4 w-4" />Compartilhar</Button><Button variant="ghost" onClick={() => void navigate({ to: "/events/new", search: { step: "detalhes" } })}><PlusCircle className="h-4 w-4" />Criar outro evento</Button></div>
      </div>
    </div>
  );
}

function ParamRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="flex flex-col gap-0.5"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</dd></div>; }
function shortAddr(addr: string): string { if (!addr) return "—"; if (addr.length <= 14) return addr; return `${addr.slice(0, 8)}…${addr.slice(-6)}`; }
async function share(title: string): Promise<void> { const url = window.location.href; try { if (navigator.share) await navigator.share({ title, url }); else await navigator.clipboard.writeText(url); } catch { } }

export const Route = createFileRoute("/_authed/confirm")({ validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({ id: (search.id as string) ?? "" }), component: ConfirmationPage });
