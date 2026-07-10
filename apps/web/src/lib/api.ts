import type {
  ApiError,
  AuthSession,
  DynamicQrContext,
  Event,
  EventInput,
  EventListItem,
} from "@ticket-chain/shared";
import type { MarketplaceEvent, OwnedTicket, ResaleListing } from "@/lib/marketplace-types";

const API_BASE = "/api";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
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

  listMarketplaceEvents: () => request<{ items: MarketplaceEvent[] }>("/marketplace/events"),
  getMarketplaceEvent: (eventId: string) => request<MarketplaceEvent>(`/marketplace/events/${eventId}`),
  listResaleListings: (eventId: string) => request<{ items: ResaleListing[] }>(`/marketplace/events/${eventId}/listings`),
  buyPrimaryTicket: (eventId: string, tierId: string) =>
    request<OwnedTicket>(`/marketplace/events/${eventId}/buy`, { method: "POST", body: JSON.stringify({ tierId }) }),
  buySecondaryListing: (listingId: string) =>
    request<OwnedTicket>(`/marketplace/listings/${listingId}/buy`, { method: "POST" }),

  listMyTickets: () => request<{ items: OwnedTicket[] }>("/tickets"),
  getTicket: (ticketId: string) => request<OwnedTicket>(`/tickets/${ticketId}`),
  getTicketQrContext: (ticketId: string) => request<DynamicQrContext>(`/tickets/${ticketId}/qr-context`),
  getDevWalletBootstrap: () => request<{ address: string; privateKey: `0x${string}`; provider: "local-dev" }>("/wallet/dev-bootstrap", { method: "POST" }),
  createResaleListing: (ticketId: string, price: number) =>
    request<OwnedTicket>(`/tickets/${ticketId}/listings`, { method: "POST", body: JSON.stringify({ price }) }),
  cancelResaleListing: (ticketId: string) =>
    request<OwnedTicket>(`/tickets/${ticketId}/listings/cancel`, { method: "POST" }),

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
