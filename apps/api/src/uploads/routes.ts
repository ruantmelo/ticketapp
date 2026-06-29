import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { VALIDATION } from "@ticket-chain/shared";
import { env } from "../config.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuth);

  app.post("/uploads/artwork", { onRequest: requireRole(["organizer"]) }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ code: "VALIDATION", message: "Arquivo não enviado." });
    }
    const mime = data.mimetype;
    if (!VALIDATION.artworkMimeTypes.includes(mime as "image/png" | "image/jpeg")) {
      return reply.code(400).send({ code: "VALIDATION", message: "Formato não suportado. Use PNG ou JPG." });
    }

    const uploadDir = resolve(env.uploadDir);
    await mkdir(uploadDir, { recursive: true });

    const id = randomUUID();
    const ext = MIME_TO_EXT[mime] ?? (extname(data.filename) || ".bin");
    const filename = `${id}${ext}`;
    const filepath = resolve(uploadDir, filename);

    let bytes = 0;
    const sink = createWriteStream(filepath);
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > VALIDATION.artworkMaxBytes) {
          callback(new Error("UPLOAD_TOO_LARGE"));
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      await pipeline(data.file, limiter, sink);
    } catch (error) {
      sink.destroy();
      await unlink(filepath).catch(() => {});
      if (error instanceof Error && error.message === "UPLOAD_TOO_LARGE") {
        return reply.code(400).send({ code: "VALIDATION", message: "Arquivo excede 5MB." });
      }
      return reply.code(400).send({ code: "VALIDATION", message: "Falha ao gravar o arquivo." });
    }

    const stats = await stat(filepath).catch(() => null);
    if (!stats || stats.size === 0) {
      return reply.code(400).send({ code: "VALIDATION", message: "Falha ao gravar o arquivo." });
    }

    return reply.code(201).send({ url: `/uploads/${filename}`, filename, bytes });
  });
}
