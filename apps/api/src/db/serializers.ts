import type { Event, EventListItem, EventPublished, TicketTier } from "@ticket-chain/shared";
import type { EventRow, TicketTierRow } from "./schema.js";

export function toTier(row: TicketTierRow): TicketTier {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    faceValue: row.faceValue,
    resaleCapPct: row.resaleCapPct,
    royaltyPct: row.royaltyPct,
  };
}

export function toEvent(row: EventRow, tiers: TicketTierRow[]): Event {
  const base = {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt,
    capacity: row.capacity,
    artworkUrl: row.artworkUrl,
    tiers: tiers.map(toTier),
  };
  if (row.status === "draft") {
    return { ...base, status: "draft" };
  }
  const published: EventPublished = {
    ...base,
    status: row.status,
    contractAddress: row.contractAddress ?? "",
    tokenStandard: row.tokenStandard ?? "ERC-721",
    totalSupply: row.totalSupply ?? 0,
    avgResaleCapPct: row.avgResaleCapPct ?? 0,
    avgRoyaltyPct: row.avgRoyaltyPct ?? 0,
    organizerId: row.organizerId,
  };
  return published;
}

export function toListItem(row: EventRow, ticketCount: number): EventListItem {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    location: row.location,
    ticketCount,
    status: row.status,
  };
}
