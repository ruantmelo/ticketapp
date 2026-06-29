import * as React from "react";
import { Upload, ImageIcon } from "lucide-react";
import type { EventForm } from "@/lib/use-event-form";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/auth";
import { VALIDATION } from "@ticket-chain/shared";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FieldError, HelperText } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  form: EventForm;
  errors: Record<string, string>;
}

export function DetalhesStep({ form, errors }: Props) {
  const { form: data, update } = form;
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > VALIDATION.artworkMaxBytes) {
      setUploadError("Arquivo excede 5MB.");
      return;
    }
    if (!VALIDATION.artworkMimeTypes.includes(file.type as "image/png" | "image/jpeg")) {
      setUploadError("Formato não suportado. Use PNG ou JPG.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await api.uploadArtwork(file);
      update("artworkUrl", url);
    } catch (err) {
      setUploadError(isApiError(err) ? err.message : "Erro no upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes do evento</CardTitle>
        <CardDescription>Informações básicas e arte do evento.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Arte do evento</label>
          {data.artworkUrl ? (
            <div className="relative w-full overflow-hidden border border-border">
              <img src={data.artworkUrl} alt="Arte do evento" className="aspect-video w-full object-cover" />
              <button
                type="button"
                onClick={() => update("artworkUrl", null)}
                className="absolute right-2 top-2 bg-secondary/90 px-2 py-1 text-xs text-secondary-foreground"
              >
                Remover
              </button>
            </div>
          ) : (
            <label
              htmlFor="artwork"
              className={cn(
                "flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-input bg-muted/30 text-muted-foreground transition-colors hover:bg-muted",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <p className="text-sm">Enviando…</p>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center bg-accent">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium text-foreground">
                      Enviar arte do evento
                    </span>
                    <span className="text-xs text-muted-foreground">
                      PNG/JPG até 5MB · proporção 16:9 recomendada
                    </span>
                  </div>
                </>
              )}
              <input
                id="artwork"
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFile}
                disabled={uploading}
              />
            </label>
          )}
          {uploadError && <FieldError message={uploadError} />}
        </div>

        <Field label="Título do evento" htmlFor="title" error={errors.title}>
          <Input
            id="title"
            placeholder="ex: Festival Verão 2026"
            value={data.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </Field>

        <Field label="Local" htmlFor="location" error={errors.location}>
          <Input
            id="location"
            placeholder="ex: Arena Mauro Sampaio, Maceió"
            value={data.location}
            onChange={(e) => update("location", e.target.value)}
          />
        </Field>

        <Field label="Descrição" htmlFor="description" error={errors.description}>
          <Textarea
            id="description"
            rows={4}
            placeholder="Descreva o evento, atrações e informações importantes para os participantes..."
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Data e hora"
            htmlFor="startsAt"
            error={errors.startsAt}
            helper={errors.startsAt ? undefined : "A data deve ser futura"}
          >
            <Input
              id="startsAt"
              type="datetime-local"
              value={toDateTimeLocal(data.startsAt)}
              onChange={(e) => update("startsAt", fromDateTimeLocal(e.target.value))}
            />
          </Field>
          <Field label="Capacidade total" htmlFor="capacity" error={errors.capacity}>
            <Input
              id="capacity"
              type="number"
              min={1}
              placeholder="ex: 1000"
              value={data.capacity || ""}
              onChange={(e) => update("capacity", Number(e.target.value))}
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function toDateTimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}
