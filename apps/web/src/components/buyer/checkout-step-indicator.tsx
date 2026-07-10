import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const CHECKOUT_STEPS = ["revisao", "pagamento", "confirmacao"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  revisao: "Revisão",
  pagamento: "Pagamento",
  confirmacao: "Confirmação",
};

export function CheckoutStepIndicator({ current }: { current: CheckoutStep }) {
  const currentIndex = CHECKOUT_STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {CHECKOUT_STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center text-sm font-medium",
                (done || active) && "bg-primary text-primary-foreground",
                !done && !active && "border border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              {CHECKOUT_STEP_LABELS[step]}
            </span>
            {i < CHECKOUT_STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
