import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "./crypto.js";
import type { JwtPayload } from "./crypto.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { UserRole } from "@ticket-chain/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload & { role: UserRole };
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies.session;
  if (!token) {
    reply.code(401).send({ code: "UNAUTHORIZED", message: "Não autenticado." });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    reply.clearCookie("session").code(401).send({ code: "UNAUTHORIZED", message: "Sessão inválida." });
    return;
  }
  const row = db.select().from(users).where(eq(users.id, payload.sub)).get();
  if (!row) {
    reply.clearCookie("session").code(401).send({ code: "UNAUTHORIZED", message: "Usuário não encontrado." });
    return;
  }
  request.user = { ...payload, role: row.role };
}

export function requireRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    if (!request.user || !roles.includes(request.user.role)) {
      reply.code(403).send({ code: "FORBIDDEN", message: "Acesso negado." });
    }
  };
}
