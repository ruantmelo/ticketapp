import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./crypto.js";
import { registerSchema, loginSchema, flattenZodErrors } from "@ticket-chain/shared";
import { env } from "../config.js";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  domain: env.nodeEnv === "production" ? env.cookieDomain : undefined,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Dados inválidos",
        fields: flattenZodErrors(parsed.error),
      });
    }
    const { name, email, password, role } = parsed.data;

    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      return reply.code(409).send({ code: "EMAIL_TAKEN", message: "E-mail já cadastrado." });
    }

    const id = randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date();
    db.insert(users)
      .values({ id, email, name, role, passwordHash, createdAt: now })
      .run();

    const token = signToken({ sub: id, email });
    reply.setCookie("session", token, COOKIE_OPTS);
    return reply.code(201).send({ user: { id, email, name, role } });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Dados inválidos",
        fields: flattenZodErrors(parsed.error),
      });
    }
    const { email, password } = parsed.data;

    const row = db.select().from(users).where(eq(users.email, email)).get();
    if (!row || !verifyPassword(password, row.passwordHash)) {
      return reply
        .code(401)
        .send({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha incorretos." });
    }

    const token = signToken({ sub: row.id, email: row.email });
    reply.setCookie("session", token, COOKIE_OPTS);
    return reply.send({ user: { id: row.id, email: row.email, name: row.name, role: row.role } });
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("session", { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const token = request.cookies.session;
    if (!token) return reply.code(401).send({ code: "UNAUTHORIZED", message: "Não autenticado." });
    const payload = verifyToken(token);
    if (!payload) {
      reply.clearCookie("session", { path: "/" });
      return reply.code(401).send({ code: "UNAUTHORIZED", message: "Sessão inválida." });
    }
    const row = db.select().from(users).where(eq(users.id, payload.sub)).get();
    if (!row) return reply.code(401).send({ code: "UNAUTHORIZED", message: "Usuário não encontrado." });
    return reply.send({ user: { id: row.id, email: row.email, name: row.name, role: row.role } });
  });
}
