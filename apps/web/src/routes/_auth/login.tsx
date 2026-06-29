import * as React from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Ticket } from "lucide-react";
import { loginSchema, flattenZodErrors } from "@ticket-chain/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth, isApiError } from "@/lib/auth";
import { safeRedirect } from "@/lib/rbac";

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_auth/login" }) as { redirect?: string };
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) return void setFieldErrors(flattenZodErrors(result.error));
    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(email, password);
      await navigate({ to: safeRedirect(search.redirect, "/events") });
    } catch (err) {
      if (isApiError(err)) { if (err.fields) setFieldErrors(err.fields); setError(err.message); } else setError("Erro ao entrar. Tente novamente.");
    } finally { setSubmitting(false); }
  }

  return <div className="flex min-h-screen w-full items-start justify-center bg-background px-4 pt-[140px]"><Card className="w-full max-w-[440px]"><CardContent className="flex flex-col gap-4 p-9"><div className="flex flex-col items-center gap-3 pb-2 text-center"><div className="flex h-12 w-12 items-center justify-center bg-primary"><Ticket className="h-6 w-6 text-primary-foreground" /></div><div className="flex flex-col gap-1"><h1 className="text-xl font-bold text-card-foreground">Ticket App</h1><p className="text-sm text-muted-foreground">Plataforma de ingressos sem cambistas</p></div></div><form onSubmit={handleSubmit} className="flex flex-col gap-4"><Field label="E-mail" htmlFor="email" error={fieldErrors.email}><Input id="email" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field><Field label="Senha" htmlFor="password" error={fieldErrors.password}><Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>{error && <FieldError message={error} />}<Button type="submit" size="lg" disabled={submitting} className="w-full">{submitting ? "Entrando…" : "Entrar"}</Button></form><div className="flex flex-col items-center gap-3 pt-2"><Link to="/register" className="text-sm font-medium text-primary hover:underline">Criar conta</Link><button type="button" className="text-sm text-muted-foreground hover:text-foreground">Esqueci a senha</button></div></CardContent></Card></div>;
}

export const Route = createFileRoute("/_auth/login")({ component: LoginPage });
