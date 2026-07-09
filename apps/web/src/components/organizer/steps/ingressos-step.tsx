import * as React from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import type { EventForm } from "@/lib/use-event-form";
import { VALIDATION } from "@ticket-chain/shared";
import { formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  form: EventForm;
  errors: Record<string, string>;
}

export function IngressosStep({ form, errors }: Props) {
  const { form: data, updateTier, addTier, removeTier } = form;
  const maxed = data.tiers.length >= VALIDATION.maxTiers;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Ingressos</CardTitle>
          <CardDescription>
            Defina os tiers, quantidades e preços.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={addTier} disabled={maxed}>
          <PlusCircle className="h-4 w-4" />
          Adicionar tier
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <Th>Nome</Th>
                <Th>Quantidade</Th>
                <Th>Preço (R$)</Th>
                <Th className="w-12"></Th>
              </tr>
            </thead>
            <tbody>
              {data.tiers.map((tier, i) => (
                <tr key={tier.id} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <Input
                      placeholder="ex: Pista"
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                      aria-label={`Nome do tier ${i + 1}`}
                    />
                    {errors[`tiers.${i}.name`] && (
                      <p className="mt-1 text-xs text-destructive">{errors[`tiers.${i}.name`]}</p>
                    )}
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={1}
                      value={tier.quantity || ""}
                      onChange={(e) => updateTier(tier.id, { quantity: Number(e.target.value) })}
                      aria-label={`Quantidade do tier ${i + 1}`}
                    />
                    {errors[`tiers.${i}.quantity`] && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors[`tiers.${i}.quantity`]}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tier.faceValue || ""}
                      onChange={(e) => updateTier(tier.id, { faceValue: Number(e.target.value) })}
                      aria-label={`Preço do tier ${i + 1}`}
                    />
                    {errors[`tiers.${i}.faceValue`] && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors[`tiers.${i}.faceValue`]}
                      </p>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {data.tiers.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTier(tier.id)}
                        aria-label={`Remover tier ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errors.tiers && <p className="text-sm text-destructive">{errors.tiers}</p>}

        <div className="flex justify-end text-sm text-muted-foreground">
          <TierSummary form={data} />
        </div>
      </CardContent>
    </Card>
  );
}

function TierSummary({ form }: { form: EventForm["form"] }) {
  const total = form.tiers.reduce((s, t) => s + t.quantity, 0);
  const revenue = form.tiers.reduce((s, t) => s + t.quantity * t.faceValue, 0);
  return (
    <span>
      {total} ingressos · receita primária {formatCurrency(revenue)}
    </span>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
