import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const WIZARD_STEPS = ["detalhes", "ingressos", "mercado_secundario", "revisao"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const STEP_LABELS: Record<WizardStep, string> = {
  detalhes: "Detalhes",
  ingressos: "Ingressos",
  mercado_secundario: "Mercado secundário",
  revisao: "Revisão",
};

export function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = WIZARD_STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {WIZARD_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center text-sm font-medium",
                done && "bg-primary text-primary-foreground",
                active && "bg-primary text-primary-foreground",
                !done && !active && "border border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {STEP_LABELS[step]}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <div className="mx-2 h-px w-8 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
