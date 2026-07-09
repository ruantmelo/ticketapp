import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, ticketTiers, ticketTokens } from "../db/schema.js";
import { env } from "../config.js";

type TicketMetadata = {
  name: string;
  description: string;
  image: string | null;
  external_url: string;
  attributes: { trait_type: string; value: string | number }[];
};

export async function metadataRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metadata/:eventId/:tokenId", async (request, reply) => {
    const { eventId, tokenId } = request.params as { eventId: string; tokenId: string };
    const metadata = loadTicketMetadata(eventId, Number(tokenId));
    if (!metadata) return reply.code(404).send({ code: "NOT_FOUND", message: "Metadata não encontrada." });
    return reply.send(metadata);
  });

  app.get("/metadata/:tokenId", async (request, reply) => {
    const { tokenId } = request.params as { tokenId: string };
    const tokenRows = db.select().from(ticketTokens).where(eq(ticketTokens.tokenId, Number(tokenId))).all();
    if (tokenRows.length !== 1) {
      return reply.code(404).send({ code: "NOT_FOUND", message: "Metadata requer eventId quando o token ID não é único." });
    }
    const metadata = loadTicketMetadata(tokenRows[0]!.eventId, Number(tokenId));
    if (!metadata) return reply.code(404).send({ code: "NOT_FOUND", message: "Metadata não encontrada." });
    return reply.send(metadata);
  });
}

function loadTicketMetadata(eventId: string, tokenId: number): TicketMetadata | null {
  if (!Number.isSafeInteger(tokenId) || tokenId <= 0) return null;
  const token = db
    .select()
    .from(ticketTokens)
    .where(and(eq(ticketTokens.eventId, eventId), eq(ticketTokens.tokenId, tokenId)))
    .get();
  if (!token) return null;
  const event = db.select().from(events).where(eq(events.id, eventId)).get();
  const tier = db.select().from(ticketTiers).where(eq(ticketTiers.id, token.tierId)).get();
  if (!event || !tier) return null;

  return {
    name: `${event.title} #${tokenId}`,
    description: event.description,
    image: event.artworkUrl,
    external_url: `${env.webOrigin.replace(/\/+$/, "")}/events/${event.id}`,
    attributes: [
      { trait_type: "event", value: event.title },
      { trait_type: "tier", value: tier.name },
      { trait_type: "face value", value: tier.faceValue },
      { trait_type: "date", value: event.startsAt },
      { trait_type: "location", value: event.location },
      { trait_type: "token ID", value: tokenId },
      { trait_type: "on-chain tier ID", value: token.onChainTierId },
    ],
  };
}
