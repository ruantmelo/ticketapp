import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import { resolve } from "node:path";
import { env } from "./config.js";
import { authRoutes } from "./auth/routes.js";
import { eventRoutes } from "./events/routes.js";
import { marketplaceRoutes } from "./marketplace/routes.js";
import { metadataRoutes } from "./metadata/routes.js";
import { uploadRoutes } from "./uploads/routes.js";
import { bullBoardRoutes } from "./admin/bull-board.js";
import { closeMintingQueue } from "./services/minting.queue.js";

export async function buildServer() {
  const app = Fastify({
    logger: env.nodeEnv === "development",
    bodyLimit: 8 * 1024 * 1024,
  });

  await app.register(cookie, {});
  await app.register(cors, { origin: env.webOrigin, credentials: true });
  await app.register(multipart, { limits: { fileSize: 6 * 1024 * 1024 } });
  await app.register(staticPlugin, {
    root: resolve(env.uploadDir),
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "" });
  await app.register(bullBoardRoutes, { prefix: "" });
  await app.register(metadataRoutes, { prefix: "" });
  await app.register(eventRoutes, { prefix: "" });
  await app.register(marketplaceRoutes, { prefix: "" });
  await app.register(uploadRoutes, { prefix: "" });

  app.addHook("onClose", async () => {
    await closeMintingQueue();
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "unhandled error");
    reply.code(500).send({ code: "INTERNAL", message: "Erro interno do servidor." });
  });

  return app;
}
