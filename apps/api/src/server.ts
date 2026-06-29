import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import { resolve } from "node:path";
import { env } from "./config.js";
import { authRoutes } from "./auth/routes.js";
import { eventRoutes } from "./events/routes.js";
import { uploadRoutes } from "./uploads/routes.js";

async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === "development",
    bodyLimit: 8 * 1024 * 1024,
  });

  await app.register(cookie, {});
  await app.register(cors, {
    origin: env.webOrigin,
    credentials: true,
  });
  await app.register(multipart, {
    limits: { fileSize: 6 * 1024 * 1024 },
  });
  await app.register(staticPlugin, {
    root: resolve(env.uploadDir),
    prefix: "/uploads/",
    decorateReply: false,
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "" });
  await app.register(eventRoutes, { prefix: "" });
  await app.register(uploadRoutes, { prefix: "" });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "unhandled error");
    reply.code(500).send({ code: "INTERNAL", message: "Erro interno do servidor." });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();
  try {
    await app.listen({ host: env.host, port: env.port });
    app.log.info(`API listening on http://${env.host}:${env.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
