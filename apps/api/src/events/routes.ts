import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, ticketTiers } from "../db/schema.js";
import type { EventRow, TicketTierRow } from "../db/schema.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { eventInputSchema, flattenZodErrors } from "@ticket-chain/shared";
import { toEvent, toTier, toListItem } from "../db/serializers.js";
import { deployAndMint } from "../services/minting.service.js";

function loadTiers(eventId: string): TicketTierRow[] {
  return db.select().from(ticketTiers).where(eq(ticketTiers.eventId, eventId)).all();
}

function loadOne(eventId: string, organizerId: string): EventRow | null {
  return db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .get() ?? null;
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuth);

  app.get("/events", async (request, reply) => {
    const organizerId = request.user!.sub;
    const rows = db.select().from(events).where(eq(events.organizerId, organizerId)).all();
    const items = rows.map((row) => {
      const tierCount = db
        .select()
        .from(ticketTiers)
        .where(eq(ticketTiers.eventId, row.id))
        .all()
        .reduce((sum, t) => sum + t.quantity, 0);
      return toListItem(row, tierCount);
    });
    items.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return reply.send({ items });
  });

  app.get("/events/drafts", async (request, reply) => {
    const organizerId = request.user!.sub;
    const rows = db
      .select()
      .from(events)
      .where(and(eq(events.organizerId, organizerId), eq(events.status, "draft")))
      .all();
    const items = rows.map((row) => {
      const tierCount = db
        .select()
        .from(ticketTiers)
        .where(eq(ticketTiers.eventId, row.id))
        .all()
        .reduce((sum, t) => sum + t.quantity, 0);
      return toListItem(row, tierCount);
    });
    return reply.send({ items });
  });

  app.get("/events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = loadOne(id, request.user!.sub);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "Evento não encontrado." });
    return reply.send(toEvent(row, loadTiers(id)));
  });

  app.post("/events/draft", { onRequest: requireRole(["organizer"]) }, async (request, reply) => {
    const organizerId = request.user!.sub;
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Dados inválidos",
        fields: flattenZodErrors(parsed.error),
      });
    }
    const input = parsed.data;
    const id = randomUUID();
    const now = new Date();
    db.insert(events)
      .values({
        id,
        organizerId,
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt: input.startsAt,
        capacity: input.capacity,
        artworkUrl: input.artworkUrl,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    insertTiers(id, input.tiers);
    const row = loadOne(id, organizerId)!;
    return reply.code(201).send(toEvent(row, loadTiers(id)));
  });

  app.put("/events/draft/:id", { onRequest: requireRole(["organizer"]) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = loadOne(id, request.user!.sub);
    if (!row) return reply.code(404).send({ code: "NOT_FOUND", message: "Evento não encontrado." });
    if (row.status !== "draft") {
      return reply.code(400).send({ code: "VALIDATION", message: "Evento já publicado." });
    }
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Dados inválidos",
        fields: flattenZodErrors(parsed.error),
      });
    }
    const input = parsed.data;
    const now = new Date();
    db.update(events)
      .set({
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt: input.startsAt,
        capacity: input.capacity,
        artworkUrl: input.artworkUrl,
        updatedAt: now,
      })
      .where(eq(events.id, id))
      .run();
    db.delete(ticketTiers).where(eq(ticketTiers.eventId, id)).run();
    insertTiers(id, input.tiers);
    return reply.send(toEvent(loadOne(id, request.user!.sub)!, loadTiers(id)));
  });

  app.post("/events", { onRequest: requireRole(["organizer"]) }, async (request, reply) => {
    const organizerId = request.user!.sub;
    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Dados inválidos",
        fields: flattenZodErrors(parsed.error),
      });
    }
    const input = parsed.data;
    const id = randomUUID();
    const now = new Date();
    db.insert(events)
      .values({
        id,
        organizerId,
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt: input.startsAt,
        capacity: input.capacity,
        artworkUrl: input.artworkUrl,
        status: "minting",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    insertTiers(id, input.tiers);
    const row = loadOne(id, organizerId)!;
    const tiers = loadTiers(id).map(toTier);

    const result = await deployAndMint({ id, title: row.title, organizerId, tiers });

    db.update(events)
      .set({
        status: "minted",
        contractAddress: result.contractAddress,
        tokenStandard: result.tokenStandard,
        totalSupply: result.totalSupply,
        avgResaleCapPct: result.avgResaleCapPct,
        avgRoyaltyPct: result.avgRoyaltyPct,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .run();

    return reply.code(201).send(toEvent(loadOne(id, organizerId)!, loadTiers(id)));
  });
}

function insertTiers(eventId: string, tiers: { name: string; quantity: number; faceValue: number; resaleCapPct: number; royaltyPct: number }[]): void {
  const now = new Date();
  for (const tier of tiers) {
    db.insert(ticketTiers)
      .values({
        id: randomUUID(),
        eventId,
        name: tier.name,
        quantity: tier.quantity,
        faceValue: tier.faceValue,
        resaleCapPct: tier.resaleCapPct,
        royaltyPct: tier.royaltyPct,
        createdAt: now,
      })
      .run();
  }
}
