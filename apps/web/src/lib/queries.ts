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
