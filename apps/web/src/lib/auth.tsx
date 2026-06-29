import * as React from "react";
import type { ApiError, User } from "@ticket-chain/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sessionQuery } from "@/lib/queries";

interface AuthContextValue { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (name: string, email: string, password: string, role?: "buyer" | "organizer") => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void>; }
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(sessionQuery);
  const loginMutation = useMutation({ mutationFn: api.login, onSuccess: async (data) => { queryClient.setQueryData(sessionQuery.queryKey, data); await queryClient.invalidateQueries({ queryKey: ["events"] }); } });
  const registerMutation = useMutation({ mutationFn: api.register, onSuccess: async (data) => { queryClient.setQueryData(sessionQuery.queryKey, data); await queryClient.invalidateQueries({ queryKey: ["events"] }); } });
  const logoutMutation = useMutation({ mutationFn: api.logout, onSuccess: async () => { await queryClient.removeQueries({ queryKey: ["session"] }); await queryClient.removeQueries({ queryKey: ["events"] }); } });
  const value = React.useMemo(() => ({ user: data?.user ?? null, loading: isLoading, login: async (email: string, password: string) => { await loginMutation.mutateAsync({ email, password }); }, register: async (name: string, email: string, password: string, role?: "buyer" | "organizer") => { await registerMutation.mutateAsync({ name, email, password, role }); }, logout: async () => { await logoutMutation.mutateAsync(); }, refresh: async () => { await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey }); } }), [data, isLoading, loginMutation, registerMutation, logoutMutation, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue { const ctx = React.useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
export function isApiError(e: unknown): e is ApiError { return typeof e === "object" && e !== null && "code" in e && "message" in e; }
