import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { registerSchema, flattenZodErrors } from "@ticket-chain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, isApiError } from "@/lib/auth";
import { defaultRouteFor } from "@/lib/rbac";

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"buyer" | "organizer">("buyer");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = registerSchema.safeParse({ name, email, password, role });
    if (!result.success) return void setFieldErrors(flattenZodErrors(result.error));
    setFieldErrors({});
    setSubmitting(true);
    try {
      const user = await register(name, email, password, role);
      await navigate({ to: defaultRouteFor(user) });
    } catch (err) {
      if (isApiError(err)) {
        if (err.fields) setFieldErrors(err.fields);
        setError(err.message);
      } else setError("Erro ao criar conta. Tente novamente.");
    } finally { setSubmitting(false); }
  }

  return <div className="flex min-h-screen w-full items-start justify-center bg-background px-4 pt-[140px]"><Card className="w-full max-w-[440px]"><CardContent className="flex flex-col gap-4 p-9"><div className="flex flex-col items-center gap-3 pb-2 text-center"><div className="flex h-12 w-12 items-center justify-center bg-primary"><Ticket className="h-6 w-6 text-primary-foreground" /></div><div className="flex flex-col gap-1"><h1 className="text-xl font-bold text-card-foreground">Criar conta</h1><p className="text-sm text-muted-foreground">Comece a vender ingressos sem cambistas</p></div></div><form onSubmit={handleSubmit} className="flex flex-col gap-4"><Field label="Nome" htmlFor="name" error={fieldErrors.name}><Input id="name" autoComplete="name" placeholder="Seu nome ou empresa" value={name} onChange={(e) => setName(e.target.value)} required /></Field><Field label="E-mail" htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Senha" htmlFor="password" error={fieldErrors.password} helper="Mínimo de 8 caracteres"><Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field><Field label="Perfil" htmlFor="role"><select id="role" value={role} onChange={(e) => setRole(e.target.value as "buyer" | "organizer")} className="h-10 w-full border border-input bg-background px-3 text-sm"><option value="buyer">Buyer</option><option value="organizer">Organizer</option></select></Field>{error && <FieldError message={error} />}<Button type="submit" size="lg" disabled={submitting} className="w-full">{submitting ? "Criando…" : "Criar conta"}</Button></form></CardContent></Card></div>;
}

export const Route = createFileRoute("/_auth/register")({ component: RegisterPage });
