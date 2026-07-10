import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "../auth/middleware.js";
import { flattenZodErrors } from "@ticket-chain/shared";
import { db } from "../db/client.js";
import { events } from "../db/schema.js";
import { validationScanRequestSchema } from "@ticket-chain/shared";
import { validateAdmissionScan } from "./service.js";

export async function validationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireRole(["validator"]));

  app.get("/validator/events", async (_request, reply) => {
    const items = db.select().from(events).where(eq(events.status, "minted")).orderBy(desc(events.startsAt)).all().map((row) => ({
      id: row.id,
      title: row.title,
      location: row.location,
      startsAt: row.startsAt,
    }));
    return reply.send({ items });
  });

  app.post("/validator/events/:eventId/scans", async (request, reply) => {
    const { eventId } = request.params as { eventId: string };
    const parsed = validationScanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "VALIDATION", message: "Dados inválidos", fields: flattenZodErrors(parsed.error) });
    }
    const payload = parsed.data.payload ?? parsed.data.qrPayload ?? "";
    const result = await validateAdmissionScan({ eventId, scannerUserId: request.user!.sub, payload });
    return reply.code(200).send(result);
  });
}
