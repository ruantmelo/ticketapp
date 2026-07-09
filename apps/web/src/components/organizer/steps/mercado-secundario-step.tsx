import type * as React from "react";
import { VALIDATION } from "@ticket-chain/shared";
import type { EventForm } from "@/lib/use-event-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Props {
  form: EventForm;
  errors: Record<string, string>;
}

export function MercadoSecundarioStep({ form, errors }: Props) {
  const { form: data, updateMarketRules } = form;
  const primaryTier = data.tiers[0] ?? { resaleCapPct: 120, royaltyPct: 5 };
  const capError = findTierError(errors, "resaleCapPct");
  const royaltyError = findTierError(errors, "royaltyPct");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras do mercado secundário</CardTitle>
        <CardDescription>
          Defina como seus ingressos poderão ser revendidos depois da venda inicial.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Estas regras valem para todos os tiers do evento.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Preço máximo de revenda"
            help="Limite quanto o comprador pode cobrar em uma resale. Ex.: 120% permite revender por até 20% acima do face value."
            error={capError}
            input={
              <PercentInput
                min={VALIDATION.resaleCapPctMin}
                max={VALIDATION.resaleCapPctMax}
                value={primaryTier.resaleCapPct}
                onChange={(value) => updateMarketRules({ resaleCapPct: value })}
                ariaLabel="Preço máximo de revenda"
              />
            }
          />

          <Field
            label="Royalty do organizador"
            help="Percentual que volta para você em cada resale aprovada."
            error={royaltyError}
            input={
              <PercentInput
                min={VALIDATION.royaltyPctMin}
                max={VALIDATION.royaltyPctMax}
                value={primaryTier.royaltyPct}
                onChange={(value) => updateMarketRules({ royaltyPct: value })}
                ariaLabel="Royalty do organizador"
              />
            }
          />
        </div>

        <Alert variant="info" title="Marketplace obrigatório">
          As revendas acontecem apenas pelo marketplace da plataforma. Transferências diretas entre
          pessoas ficam bloqueadas para evitar cambismo.
        </Alert>

        <Alert variant="warning" title="Regras imutáveis">
          Depois de publicar o evento, estas regras não poderão ser alteradas.
        </Alert>
      </CardContent>
    </Card>
  );
}

function findTierError(errors: Record<string, string>, field: "resaleCapPct" | "royaltyPct") {
  return Object.entries(errors).find(([key]) => key.startsWith("tiers.") && key.endsWith(`.${field}`))?.[1];
}

function PercentInput({
  min,
  max,
  value,
  onChange,
  ariaLabel,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative max-w-40">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={ariaLabel}
        className="pr-10"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        %
      </span>
    </div>
  );
}

function Field({
  label,
  help,
  error,
  input,
}: {
  label: string;
  help: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {input}
      <p className="text-xs text-muted-foreground">{help}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
