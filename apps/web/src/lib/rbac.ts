import type { User } from "@ticket-chain/shared";

export function canOrganize(user: User | null | undefined): boolean {
  return user?.role === "organizer";
}

export function safeRedirect(value: unknown, fallback = "/events"): string {
  return typeof value === "string" && value.startsWith("/") ? value : fallback;
}
