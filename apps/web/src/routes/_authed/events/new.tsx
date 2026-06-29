import * as React from "react";
import { createFileRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import {
  detalhesSchema,
  ingressosSchema,
  flattenZodErrors,
} from "@ticket-chain/shared";
import { useEventForm } from "@/lib/use-event-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  StepIndicator,
  WIZARD_STEPS,
  type WizardStep,
} from "@/components/organizer/step-indicator";
import { DetalhesStep } from "@/components/organizer/steps/detalhes-step";
import { IngressosStep } from "@/components/organizer/steps/ingressos-step";
import { RevisaoStep } from "@/components/organizer/steps/revisao-step";
import { canOrganize } from "@/lib/rbac";
import { sessionQuery } from "@/lib/queries";

interface WizardSearch {
  step: WizardStep;
}

function EventWizard() {
  const search = useSearch({ from: "/_authed/events/new" }) as WizardSearch;
  const navigate = useNavigate();
  const form = useEventForm();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [publishError, setPublishError] = React.useState<string | null>(null);

  const currentStep: WizardStep = WIZARD_STEPS.includes(search.step)
    ? search.step
    : "detalhes";
  const currentIndex = WIZARD_STEPS.indexOf(currentStep);

  const goToStep = React.useCallback(
    (step: WizardStep) => {
      void navigate({ to: "/events/new", search: { step } });
    },
    [navigate],
  );

  function validateDetalhes(): boolean {
    const result = detalhesSchema.safeParse(form.form);
    setErrors(result.success ? {} : flattenZodErrors(result.error));
    return result.success;
  }

  function validateIngressos(): boolean {
    const result = ingressosSchema.safeParse({ tiers: form.form.tiers });
    setErrors(result.success ? {} : flattenZodErrors(result.error));
    return result.success;
  }

  function handleNext() {
    if (currentStep === "detalhes") {
      if (!validateDetalhes()) return;
      goToStep("ingressos");
    } else if (currentStep === "ingressos") {
      if (!validateIngressos()) return;
      setErrors({});
      goToStep("revisao");
    }
  }

  function handleBack() {
    if (currentStep === "ingressos") goToStep("detalhes");
    else if (currentStep === "revisao") goToStep("ingressos");
  }

  async function handlePublish() {
    if (!validateDetalhes() || !validateIngressos()) return;
    setPublishError(null);
    const result = await form.publish();
    if (result.ok) {
      void navigate({ to: "/confirm", search: { id: result.event.id } });
    } else {
      setPublishError(result.error);
      if (result.fields) setErrors(result.fields);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/events" },
          { label: "Eventos", to: "/events" },
          { label: "Criar" },
        ]}
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">
          Criar novo evento
        </h1>
        <p className="text-sm text-muted-foreground">
          Preencha os detalhes do seu evento e configure os ingressos. O sistema
          cuida do mint na blockchain.
        </p>
      </div>

      <StepIndicator current={currentStep} />

      {currentStep === "detalhes" && (
        <DetalhesStep form={form} errors={errors} />
      )}
      {currentStep === "ingressos" && (
        <IngressosStep form={form} errors={errors} />
      )}
      {currentStep === "revisao" && <RevisaoStep form={form} />}

      {publishError && (
        <p className="text-sm text-destructive">{publishError}</p>
      )}
      {form.saveError && (
        <p className="text-sm text-destructive">{form.saveError}</p>
      )}
      {form.lastSavedAt && (
        <p className="text-xs text-muted-foreground">
          Rascunho salvo às {form.lastSavedAt.toLocaleTimeString("pt-BR")}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={() => void form.saveDraft()}
          disabled={form.saving}
        >
          {form.saving ? "Salvando…" : "Salvar rascunho"}
        </Button>

        <div className="flex items-center gap-3">
          {currentIndex > 0 && (
            <Button variant="ghost" onClick={handleBack}>
              Voltar
            </Button>
          )}
          {currentStep !== "revisao" ? (
            <Button onClick={handleNext}>
              {currentStep === "detalhes" ? "Próximo" : "Revisar"}
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={form.saving}>
              {form.saving ? "Mintando…" : "Criar evento"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authed/events/new")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery);
    if (!canOrganize(session.user)) throw redirect({ to: "/events" });
  },
  validateSearch: (search: Record<string, unknown>): WizardSearch => ({
    step: (search.step as WizardStep) ?? "detalhes",
  }),
  component: EventWizard,
});
