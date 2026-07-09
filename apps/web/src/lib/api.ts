import type {
  ApiError,
  AuthSession,
  Event,
  EventInput,
  EventListItem,
} from "@ticket-chain/shared";

const API_BASE = "/api";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw body as ApiError;
  }
  return body as T;
}

export const api = {
  register: (data: { name: string; email: string; password: string; role?: "buyer" | "organizer" }) =>
    request<AuthSession>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<AuthSession>("/auth/me"),

  listEvents: () => request<{ items: EventListItem[] }>("/events"),
  listDrafts: () => request<{ items: EventListItem[] }>("/events/drafts"),
  getEvent: (id: string) => request<Event>(`/events/${id}`),
  retryMinting: (id: string) => request<Event>(`/events/${id}/minting/retry`, { method: "POST" }),
  saveDraft: (data: EventInput) =>
    request<Event>("/events/draft", { method: "POST", body: JSON.stringify(data) }),
  updateDraft: (id: string, data: EventInput) =>
    request<Event>(`/events/draft/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publishEvent: (data: EventInput) =>
    request<Event>("/events", { method: "POST", body: JSON.stringify(data) }),

  uploadArtwork: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/uploads/artwork`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw body as ApiError;
    return body as { url: string };
  },
};
