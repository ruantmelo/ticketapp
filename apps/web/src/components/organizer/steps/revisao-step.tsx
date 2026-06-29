import type { EventForm } from "@/lib/use-event-form";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ImageIcon } from "lucide-react";

interface Props {
  form: EventForm;
}

export function RevisaoStep({ form }: Props) {
  const { form: data } = form;
  const totalSupply = data.tiers.reduce((s, t) => s + t.quantity, 0);
  const sumResale = data.tiers.reduce((s, t) => s + t.resaleCapPct * t.quantity, 0);
  const sumRoyalty = data.tiers.reduce((s, t) => s + t.royaltyPct * t.quantity, 0);
  const avgCap = totalSupply > 0 ? Math.round(sumResale / totalSupply) : 0;
  const avgRoyalty = totalSupply > 0 ? Math.round(sumRoyalty / totalSupply) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Revisão & parâmetros on-chain</CardTitle>
          <CardDescription>
            Confira os parâmetros antes de mintar seus ingressos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex gap-6">
            <div className="w-[240px] shrink-0 overflow-hidden border border-border bg-muted/30">
              {data.artworkUrl ? (
                <img
                  src={data.artworkUrl}
                  alt={data.title}
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <h3 className="text-xl font-bold text-foreground">{data.title || "—"}</h3>
              <p className="text-sm text-muted-foreground">
                {data.startsAt ? formatDate(data.startsAt) : "—"} · {data.location || "—"} ·
                Capacidade: {data.capacity || "—"}
              </p>
              {data.description && (
                <p className="text-sm text-muted-foreground">{data.description}</p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                    Tier
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                    Qtd
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                    Preço
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                    Cap
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                    Royalty
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tiers.map((tier) => (
                  <tr key={tier.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{tier.name || "—"}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {tier.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatCurrency(tier.faceValue)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {tier.resaleCapPct}%
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {tier.royaltyPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros on-chain</CardTitle>
          <CardDescription>
            Serão definidos no contrato no momento do mint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            <ParamRow label="Padrão de token" value="ERC-721" />
            <ParamRow label="Endereço do contrato" value="a definir no mint" mono />
            <ParamRow label="Supply total" value={String(totalSupply)} />
            <ParamRow label="Cap de revenda médio" value={`${avgCap}%`} />
            <ParamRow label="Royalty média" value={`${avgRoyalty}%`} />
            <ParamRow label="Royalty destinatário" value="Organizador (você)" />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ParamRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
