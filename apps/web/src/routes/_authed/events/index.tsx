import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, PlusCircle, MoreHorizontal } from "lucide-react";
import type { EventListItem } from "@ticket-chain/shared";
import { useAuth } from "@/lib/auth";
import { eventsQuery } from "@/lib/queries";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatDateShort, cn } from "@/lib/utils";

interface EventsSearch {
  status?: "draft";
}

function MyEventsPage() {
  const { user } = useAuth();
  const search = useSearch({ from: "/_authed/events/" });
  const { data, isLoading, error } = useQuery(eventsQuery);
  const allItems = data?.items ?? [];
  const items = search.status === "draft" ? allItems.filter((e) => e.status === "draft") : allItems;
  const published = items.filter((e) => e.status !== "draft").length;
  const drafts = items.filter((e) => e.status === "draft").length;
  const title = search.status === "draft" ? "Rascunhos" : "Meus eventos";

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs items={[{ label: "Início", to: "/events" }, { label: title }]} />
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{items.length} evento{items.length !== 1 ? "s" : ""} · {published} publicado{published !== 1 ? "s" : ""} · {drafts} rascunho{drafts !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="default" disabled><Download className="h-4 w-4" />Exportar</Button>
          {user?.role === "organizer" && <Link to="/events/new" search={{ step: "detalhes" }}><Button size="default"><PlusCircle className="h-4 w-4" />Criar evento</Button></Link>}
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando eventos…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar seus eventos.</p>}
      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border py-16">
          <p className="text-sm text-muted-foreground">Você ainda não criou nenhum evento.</p>
          {user?.role === "organizer" && <Link to="/events/new" search={{ step: "detalhes" }}><Button><PlusCircle className="h-4 w-4" />Criar primeiro evento</Button></Link>}
        </div>
      )}
      {!isLoading && !error && items.length > 0 && (
        <Table>
          <THead><TR><TH>Evento</TH><TH>Data</TH><TH>Local</TH><TH>Ingressos</TH><TH>Status</TH><TH className="w-12">Ações</TH></TR></THead>
          <TBody>{items.map((event) => <TR key={event.id}><TD className="font-medium text-foreground">{event.title}</TD><TD className="text-muted-foreground">{formatDateShort(event.startsAt)}</TD><TD className="text-muted-foreground">{event.location}</TD><TD className="text-muted-foreground">{event.ticketCount}</TD><TD><StatusBadge status={event.status} /></TD><TD><Button variant="ghost" size="icon" disabled><MoreHorizontal className="h-4 w-4" /></Button></TD></TR>)}</TBody>
        </Table>
      )}
      {!isLoading && !error && items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Mostrando {items.length} de {items.length} evento{items.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">{[1, 2, 3, 4].map((p) => <button key={p} className={cn("flex h-9 w-9 items-center justify-center border border-border text-sm", p === 1 && "border-primary bg-background font-medium text-primary", p !== 1 && "bg-background hover:bg-muted")}>{p}</button>)}</div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EventListItem["status"] }) {
  const map = { draft: { variant: "secondary" as const, label: "Rascunho" }, published: { variant: "info" as const, label: "Publicado" }, minting: { variant: "warning" as const, label: "Mintando" }, minted: { variant: "success" as const, label: "Mintado" } };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export const Route = createFileRoute("/_authed/events/")({
  validateSearch: (search: Record<string, unknown>): EventsSearch =>
    search.status === "draft" ? { status: "draft" } : {},
  component: MyEventsPage,
});
