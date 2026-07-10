import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => api.me(),
  retry: false,
});

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => api.listEvents(),
});

export const eventDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["events", id],
    queryFn: () => api.getEvent(id),
    enabled: !!id,
  });

export const marketplaceEventsQuery = queryOptions({
  queryKey: ["marketplace", "events"],
  queryFn: () => api.listMarketplaceEvents(),
});

export const marketplaceEventQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["marketplace", "events", eventId],
    queryFn: () => api.getMarketplaceEvent(eventId),
    enabled: !!eventId,
  });

export const resaleListingsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["marketplace", "listings", eventId],
    queryFn: () => api.listResaleListings(eventId),
    enabled: !!eventId,
  });

export const myTicketsQuery = queryOptions({
  queryKey: ["tickets"],
  queryFn: () => api.listMyTickets(),
});

export const ticketDetailQuery = (ticketId: string) =>
  queryOptions({
    queryKey: ["tickets", ticketId],
    queryFn: () => api.getTicket(ticketId),
    enabled: !!ticketId,
  });
