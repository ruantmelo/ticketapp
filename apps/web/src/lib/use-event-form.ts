import * as React from "react";
import type { Event, EventInput, EventPublished, TicketTier } from "@ticket-chain/shared";
import { VALIDATION } from "@ticket-chain/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/auth";
import { sessionQuery } from "@/lib/queries";

function newTier(): TicketTier {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: 1,
    faceValue: 0,
    resaleCapPct: 120,
    royaltyPct: 5,
  };
}

function emptyForm(): EventInput {
  return {
    title: "",
    description: "",
    location: "",
    startsAt: "",
    capacity: 0,
    artworkUrl: null,
    tiers: [newTier()],
  };
}

export interface ValidationErrors {
  fields: Record<string, string>;
}

export function useEventForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<EventInput>(emptyForm());
  const [draftId, setDraftId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);

  const update = React.useCallback(
    <K extends keyof EventInput>(key: K, value: EventInput[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateTier = React.useCallback((id: string, patch: Partial<TicketTier>) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const addTier = React.useCallback(() => {
    setForm((prev) =>
      prev.tiers.length >= VALIDATION.maxTiers
        ? prev
        : { ...prev, tiers: [...prev.tiers, newTier()] },
    );
  }, []);

  const removeTier = React.useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((t) => t.id !== id),
    }));
  }, []);

  const loadDraft = React.useCallback(async (id: string) => {
    try {
      const event = await api.getEvent(id);
      if (event.status === "draft") {
        setForm({
          title: event.title,
          description: event.description,
          location: event.location,
          startsAt: event.startsAt,
          capacity: event.capacity,
          artworkUrl: event.artworkUrl,
          tiers: event.tiers,
        });
        setDraftId(id);
      }
    } catch {
      // draft not found or not a draft — ignore
    }
  }, []);

  const saveMutation = useMutation({ mutationFn: async () => draftId ? api.updateDraft(draftId, form) : api.saveDraft(form), onSuccess: async (event) => { if (!draftId) setDraftId(event.id); setLastSavedAt(new Date()); await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey }); await queryClient.invalidateQueries({ queryKey: ["events"] }); if (draftId) await queryClient.invalidateQueries({ queryKey: ["events", draftId] }); }, onError: (err) => setSaveError(isApiError(err) ? err.message : "Erro ao salvar rascunho.") });
  const publishMutation = useMutation({ mutationFn: () => api.publishEvent(form), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey }); await queryClient.invalidateQueries({ queryKey: ["events"] }); }, onError: () => {} });

  const saveDraft = React.useCallback(async () => { setSaving(true); setSaveError(null); try { await saveMutation.mutateAsync(); } finally { setSaving(false); } }, [saveMutation]);
  const publish = React.useCallback(async (): Promise<{ ok: true; event: EventPublished } | { ok: false; error: string; fields?: Record<string, string> }> => { setSaving(true); setSaveError(null); try { const event = await publishMutation.mutateAsync(); if (event.status === "draft") return { ok: false, error: "Evento não foi publicado." }; return { ok: true, event }; } catch (err) { if (isApiError(err)) return { ok: false, error: err.message, fields: err.fields }; return { ok: false, error: "Erro ao publicar evento." }; } finally { setSaving(false); } }, [publishMutation]);

  return {
    form,
    draftId,
    saving,
    saveError,
    lastSavedAt,
    update,
    updateTier,
    addTier,
    removeTier,
    loadDraft,
    saveDraft,
    publish,
  };
}

export type EventForm = ReturnType<typeof useEventForm>;
