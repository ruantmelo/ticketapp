import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { events, listings, ticketTiers, ticketTokens, users, type TicketTierRow, type TicketTokenRow } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { buyListingOnChain, cancelListingOnChain, listOnChain, transferPrimarySale } from "../services/marketplace.service.js";

const createListingSchema = z.object({ price: z.number().int().positive() });

function loadMintedEvent(eventId: string) {
  return db.select().from(events).where(and(eq(events.id, eventId), eq(events.status, "minted"))).get() ?? null;
}

function loadTiers(eventId: string): TicketTierRow[] {
  return db.select().from(ticketTiers).where(eq(ticketTiers.eventId, eventId)).all();
}

function availableCount(tierId: string): number {
  return db
    .select()
    .from(ticketTokens)
    .where(and(eq(ticketTokens.tierId, tierId), eq(ticketTokens.status, "available")))
    .all().length;
}

function serializeMarketplaceEvent(row: typeof events.$inferSelect) {
  const tiers = loadTiers(row.id);
  return {
    id: row.id,
    title: row.title,
    organizerName: loadOrganizerName(row.organizerId),
    location: row.location,
    startsAt: row.startsAt,
    artworkUrl: row.artworkUrl,
    tiers: tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      faceValue: tier.faceValue,
      available: availableCount(tier.id),
      resaleCapPct: tier.resaleCapPct,
    })),
  };
}

function loadOrganizerName(organizerId: string): string {
  return db.select().from(users).where(eq(users.id, organizerId)).get()?.name ?? "Organizador";
}

function serializeTicket(token: TicketTokenRow) {
  const event = db.select().from(events).where(eq(events.id, token.eventId)).get();
  const tier = db.select().from(ticketTiers).where(eq(ticketTiers.id, token.tierId)).get();
  const activeListing = db
    .select()
    .from(listings)
    .where(and(eq(listings.ticketTokenId, token.id), eq(listings.status, "active")))
    .get();
  return {
    id: token.id,
    eventId: token.eventId,
    eventTitle: event?.title ?? "",
    eventLocation: event?.location ?? "",
    eventStartsAt: event?.startsAt ?? "",
    artworkUrl: event?.artworkUrl ?? null,
    tierName: tier?.name ?? "",
    faceValue: tier?.faceValue ?? 0,
    resaleCapPct: tier?.resaleCapPct ?? 0,
    tokenId: String(token.tokenId),
    status: token.status === "listed" ? "listed" : token.status === "burned" ? "used" : "valid",
    listingPrice: activeListing?.priceReais ?? null,
  };
}

export async function marketplaceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuth);

  app.get("/marketplace/events", async (_request, reply) => {
    const rows = db.select().from(events).where(eq(events.status, "minted")).all();
    return reply.send({ items: rows.map(serializeMarketplaceEvent) });
  });

  app.get("/marketplace/events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = loadMintedEvent(id);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "Evento não encontrado." });
    return reply.send(serializeMarketplaceEvent(row));
  });

  app.get("/marketplace/events/:id/listings", async (request, reply) => {
    const { id } = request.params as { id: string };
    const viewerId = request.user!.sub;
    const rows = db
      .select({ listing: listings, token: ticketTokens, tier: ticketTiers, seller: users })
      .from(listings)
      .innerJoin(ticketTokens, eq(listings.ticketTokenId, ticketTokens.id))
      .innerJoin(ticketTiers, eq(ticketTokens.tierId, ticketTiers.id))
      .innerJoin(users, eq(listings.sellerId, users.id))
      .where(and(eq(ticketTokens.eventId, id), eq(listings.status, "active")))
      .all();

    return reply.send({
      items: rows.map(({ listing, tier, seller }) => ({
        id: listing.id,
        eventId: id,
        tierId: tier.id,
        tierName: tier.name,
        faceValue: tier.faceValue,
        price: listing.priceReais,
        sellerName: listing.sellerId === viewerId ? "Você" : seller.name,
        listedAt: listing.createdAt.toISOString(),
        isOwn: listing.sellerId === viewerId,
      })),
    });
  });

  app.post("/marketplace/events/:id/buy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tierId } = (request.body ?? {}) as { tierId?: string };
    const buyerId = request.user!.sub;
    const event = loadMintedEvent(id);
    if (!event || !event.contractAddress) return reply.code(404).send({ code: "NOT_FOUND", message: "Evento não encontrado." });

    const token = db
      .select()
      .from(ticketTokens)
      .where(and(eq(ticketTokens.eventId, id), eq(ticketTokens.tierId, tierId ?? ""), eq(ticketTokens.status, "available")))
      .get();
    if (!token) return reply.code(409).send({ code: "SOLD_OUT", message: "Ingresso esgotado." });

    try {
      await transferPrimarySale(event.contractAddress, token.tokenId);
    } catch (error) {
      return reply.code(502).send({ code: "CHAIN_ERROR", message: error instanceof Error ? error.message : "Falha na transferência on-chain." });
    }

    db.update(ticketTokens).set({ ownerUserId: buyerId, status: "owned" }).where(eq(ticketTokens.id, token.id)).run();
    return reply.code(201).send(serializeTicket({ ...token, ownerUserId: buyerId, status: "owned" }));
  });

  app.post("/marketplace/listings/:id/buy", async (request, reply) => {
    const { id } = request.params as { id: string };
    const buyerId = request.user!.sub;
    const listing = db.select().from(listings).where(and(eq(listings.id, id), eq(listings.status, "active"))).get();
    if (!listing) return reply.code(404).send({ code: "NOT_FOUND", message: "Anúncio não encontrado." });
    if (listing.sellerId === buyerId) {
      return reply.code(400).send({ code: "OWN_LISTING", message: "Você não pode comprar seu próprio anúncio." });
    }

    const token = db.select().from(ticketTokens).where(eq(ticketTokens.id, listing.ticketTokenId)).get();
    const event = token ? db.select().from(events).where(eq(events.id, token.eventId)).get() : null;
    if (!token || !event) return reply.code(404).send({ code: "NOT_FOUND", message: "Ingresso não encontrado." });

    if (listing.onChainListingId != null) {
      try {
        await buyListingOnChain(listing.onChainListingId, listing.priceReais);
      } catch (error) {
        return reply.code(502).send({ code: "CHAIN_ERROR", message: error instanceof Error ? error.message : "Falha na compra on-chain." });
      }
    }

    db.update(listings).set({ status: "sold" }).where(eq(listings.id, id)).run();
    db.update(ticketTokens).set({ ownerUserId: buyerId, status: "owned" }).where(eq(ticketTokens.id, token.id)).run();
    return reply.send(serializeTicket({ ...token, ownerUserId: buyerId, status: "owned" }));
  });

  app.get("/tickets", async (request, reply) => {
    const userId = request.user!.sub;
    const rows = db.select().from(ticketTokens).where(eq(ticketTokens.ownerUserId, userId)).all();
    return reply.send({ items: rows.map(serializeTicket) });
  });

  app.get("/tickets/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const token = db.select().from(ticketTokens).where(and(eq(ticketTokens.id, id), eq(ticketTokens.ownerUserId, userId))).get();
    if (!token) return reply.code(404).send({ code: "NOT_FOUND", message: "Ingresso não encontrado." });
    return reply.send(serializeTicket(token));
  });

  app.post("/tickets/:id/listings", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const parsed = createListingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ code: "VALIDATION", message: "Preço inválido." });

    const token = db.select().from(ticketTokens).where(and(eq(ticketTokens.id, id), eq(ticketTokens.ownerUserId, userId))).get();
    if (!token) return reply.code(404).send({ code: "NOT_FOUND", message: "Ingresso não encontrado." });
    if (token.status !== "owned") return reply.code(400).send({ code: "INVALID_STATUS", message: "Este ingresso não pode ser anunciado." });

    const tier = db.select().from(ticketTiers).where(eq(ticketTiers.id, token.tierId)).get()!;
    // Must match TicketNFT.maxResalePrice's on-chain integer division (truncates), not round —
    // otherwise the API can accept a price the real contract rejects.
    const cap = Math.floor((tier.faceValue * tier.resaleCapPct) / 100);
    if (parsed.data.price > cap) {
      return reply.code(400).send({ code: "OVER_CAP", message: `Preço acima do limite permitido (${cap}).` });
    }

    const event = db.select().from(events).where(eq(events.id, token.eventId)).get()!;
    let onChainListingId: number | null = null;
    if (event.contractAddress) {
      try {
        onChainListingId = await listOnChain(event.contractAddress, token.tokenId, parsed.data.price);
      } catch (error) {
        return reply.code(502).send({ code: "CHAIN_ERROR", message: error instanceof Error ? error.message : "Falha ao anunciar on-chain." });
      }
    }

    const now = new Date();
    db.insert(listings)
      .values({ id: randomUUID(), ticketTokenId: token.id, sellerId: userId, priceReais: parsed.data.price, onChainListingId, status: "active", createdAt: now })
      .run();
    db.update(ticketTokens).set({ status: "listed" }).where(eq(ticketTokens.id, token.id)).run();

    return reply.code(201).send(serializeTicket({ ...token, status: "listed" }));
  });

  app.post("/tickets/:id/listings/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user!.sub;
    const token = db.select().from(ticketTokens).where(and(eq(ticketTokens.id, id), eq(ticketTokens.ownerUserId, userId))).get();
    if (!token) return reply.code(404).send({ code: "NOT_FOUND", message: "Ingresso não encontrado." });

    const listing = db.select().from(listings).where(and(eq(listings.ticketTokenId, token.id), eq(listings.status, "active"))).get();
    if (!listing) return reply.code(400).send({ code: "NOT_LISTED", message: "Este ingresso não está à venda." });

    if (listing.onChainListingId != null) {
      try {
        await cancelListingOnChain(listing.onChainListingId);
      } catch (error) {
        return reply.code(502).send({ code: "CHAIN_ERROR", message: error instanceof Error ? error.message : "Falha ao cancelar on-chain." });
      }
    }

    db.update(listings).set({ status: "cancelled" }).where(eq(listings.id, listing.id)).run();
    db.update(ticketTokens).set({ status: "owned" }).where(eq(ticketTokens.id, token.id)).run();
    return reply.send(serializeTicket({ ...token, status: "owned" }));
  });
}
