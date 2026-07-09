import type { FastifyInstance, FastifyRequest } from "fastify";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { env } from "../config.js";
import { createMintingQueueForInspection } from "../services/minting.queue.js";

export async function bullBoardRoutes(app: FastifyInstance): Promise<void> {
  if (!env.bullBoardEnabled) return;

  const serverAdapter = new FastifyAdapter();
  const queue = createMintingQueueForInspection();

  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });

  serverAdapter.setBasePath(env.bullBoardBasePath);
  await app.register(async (adminApp) => {
    adminApp.addHook("onRequest", async (request, reply) => {
      if (!env.bullBoardAllowRemote && !isLoopbackRequest(request)) {
        return reply.code(403).send({ code: "FORBIDDEN", message: "Bull Board disponível apenas localmente." });
      }
    });
    await adminApp.register(serverAdapter.registerPlugin());
  }, { prefix: env.bullBoardBasePath });

  app.addHook("onClose", async () => {
    await queue.close();
  });
}

function isLoopbackRequest(request: FastifyRequest): boolean {
  const host = request.hostname?.split(":")[0] ?? "";
  const ip = request.ip;
  return ["localhost", "127.0.0.1", "::1"].includes(host) || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}
