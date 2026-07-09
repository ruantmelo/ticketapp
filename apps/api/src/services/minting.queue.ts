import { Queue, Worker, QueueEvents, type ConnectionOptions, type JobsOptions } from "bullmq";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, ticketTiers, ticketTokens, type TicketTierRow } from "../db/schema.js";
import { toTier } from "../db/serializers.js";
import { env } from "../config.js";
import { buildMockMintedTokens, deployAndMint } from "./minting.service.js";

export type MintEventJob = { eventId: string; organizerId: string };

export const mintingQueueName = "ticket-minting";
const defaultJobOptions: JobsOptions = {
  attempts: 1,
  removeOnComplete: 100,
  removeOnFail: false,
};

let queue: Queue<MintEventJob, unknown, "mint-event"> | null = null;

export async function enqueueMintingJob(input: MintEventJob): Promise<string> {
  const mintingQueue = getMintingQueue();
  const job = await mintingQueue.add("mint-event", input, {
    ...defaultJobOptions,
    jobId: input.eventId,
  });
  return job.id ?? input.eventId;
}

export async function retryMintingJob(input: MintEventJob): Promise<string> {
  const mintingQueue = getMintingQueue();
  const previous = await mintingQueue.getJob(input.eventId);
  if (previous) await previous.remove();
  return enqueueMintingJob(input);
}

export async function closeMintingQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

export async function startMintingWorker(logger: Pick<Console, "info" | "error"> = console): Promise<() => Promise<void>> {
  const worker = new Worker<MintEventJob, unknown, "mint-event">(
    mintingQueueName,
    async (job) => processMintingJob(job.data),
    { connection: createWorkerRedisConnection(), concurrency: env.mintingQueueConcurrency },
  );
  const queueEvents = new QueueEvents(mintingQueueName, { connection: createWorkerRedisConnection() });

  worker.on("failed", (job, error) => {
    logger.error(`minting job failed jobId=${job?.id ?? "unknown"} eventId=${job?.data.eventId ?? "unknown"} err=${error instanceof Error ? error.message : String(error)}`);
  });
  worker.on("error", (error) => {
    logger.error(`minting worker error err=${error instanceof Error ? error.message : String(error)}`);
  });
  queueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error(`minting queue failed event jobId=${jobId} reason=${failedReason}`);
  });
  queueEvents.on("error", (error) => {
    logger.error(`minting queue events error err=${error instanceof Error ? error.message : String(error)}`);
  });

  await recoverMintingEventsUntilReady(logger);

  return async () => {
    await queueEvents.close();
    await worker.close();
    await closeMintingQueue();
  };
}

async function recoverMintingEventsUntilReady(logger: Pick<Console, "info" | "error">): Promise<void> {
  while (true) {
    try {
      await recoverMintingEvents();
      return;
    } catch (error) {
      logger.error(`failed to recover minting events; retrying err=${error instanceof Error ? error.message : String(error)}`);
      await delay(5_000);
    }
  }
}

async function recoverMintingEvents(): Promise<void> {
  const rows = db.select().from(events).where(eq(events.status, "minting")).all();
  for (const row of rows) {
    const jobId = await recoverMintingEventJob({ eventId: row.id, organizerId: row.organizerId });
    db.update(events).set({ mintJobId: jobId, updatedAt: new Date() }).where(eq(events.id, row.id)).run();
  }
}

async function recoverMintingEventJob(input: MintEventJob): Promise<string> {
  const mintingQueue = getMintingQueue();
  const previous = await mintingQueue.getJob(input.eventId);
  if (!previous) return enqueueMintingJob(input);

  const state = await previous.getState();
  if (state === "failed" || state === "completed" || state === "unknown") {
    await previous.remove();
    return enqueueMintingJob(input);
  }

  return previous.id ?? input.eventId;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMintingQueue(): Queue<MintEventJob, unknown, "mint-event"> {
  if (!queue) queue = new Queue<MintEventJob, unknown, "mint-event">(mintingQueueName, { connection: createProducerRedisConnection(), defaultJobOptions });
  return queue;
}

export function createMintingQueueForInspection(): Queue<MintEventJob, unknown, "mint-event"> {
  return new Queue<MintEventJob, unknown, "mint-event">(mintingQueueName, { connection: createProducerRedisConnection() });
}

function createProducerRedisConnection(): ConnectionOptions {
  const connection = parseRedisUrl();
  return { ...connection, maxRetriesPerRequest: 1, connectTimeout: 5000 };
}

function createWorkerRedisConnection(): ConnectionOptions {
  const connection = parseRedisUrl();
  return { ...connection, maxRetriesPerRequest: null };
}

function parseRedisUrl(): Omit<ConnectionOptions, "maxRetriesPerRequest" | "connectTimeout"> {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || "6379"),
    username: url.username || undefined,
    password: url.password || undefined,
    db: Number(url.pathname.replace(/^\//, "") || "0"),
  };
}

export async function processMintingJob(input: MintEventJob): Promise<void> {
  const row = db
    .select()
    .from(events)
    .where(and(eq(events.id, input.eventId), eq(events.organizerId, input.organizerId)))
    .get();
  if (!row) throw new Error("Evento não encontrado para minting");
  if (row.status === "minted") return;
  if (row.status !== "minting" && row.status !== "mint_failed") {
    throw new Error(`Evento em status inválido para minting: ${row.status}`);
  }

  db.update(events)
    .set({ status: "minting", mintError: null, mintCount: row.mintCount ?? 0, mintTotal: row.mintTotal ?? row.totalSupply ?? 0, updatedAt: new Date() })
    .where(eq(events.id, input.eventId))
    .run();

  const tiers = db.select().from(ticketTiers).where(eq(ticketTiers.eventId, input.eventId)).all();
  try {
    const result = await deployAndMint(
      { id: row.id, title: row.title, organizerId: row.organizerId, tiers: tiers.map(toTier) },
      {
        onContractResolved: (resolved) => persistResolvedContract(row.id, resolved),
        onProgress: (mintedCount, totalSupply) => persistMintProgress(row.id, mintedCount, totalSupply),
      },
    );
    const now = new Date();
    markEventMintedAndIndexTokens(input.eventId, tiers, result, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no minting";
    db.update(events)
      .set({ status: "mint_failed", mintError: message, updatedAt: new Date() })
      .where(eq(events.id, input.eventId))
      .run();
    throw error;
  }
}

function persistResolvedContract(eventId: string, result: Awaited<ReturnType<typeof deployAndMint>>): void {
  db.update(events)
    .set({
      contractAddress: result.contractAddress,
      tokenStandard: result.tokenStandard,
      totalSupply: result.totalSupply,
      avgResaleCapPct: result.avgResaleCapPct,
      avgRoyaltyPct: result.avgRoyaltyPct,
      mintTotal: result.totalSupply,
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .run();
}

function markEventMintedAndIndexTokens(
  eventId: string,
  tiers: TicketTierRow[],
  result: Awaited<ReturnType<typeof deployAndMint>>,
  now: Date,
): void {
  const tokens = buildMockMintedTokens(tiers.map(toTier));
  db.transaction(() => {
    db.delete(ticketTokens).where(eq(ticketTokens.eventId, eventId)).run();
    for (const token of tokens) {
      db.insert(ticketTokens)
        .values({
          id: `${eventId}:${token.tokenId}`,
          eventId,
          tokenId: token.tokenId,
          tierId: token.tierId,
          onChainTierId: token.onChainTierId,
          createdAt: now,
        })
        .run();
    }
    db.update(events)
      .set({
        status: "minted",
        contractAddress: result.contractAddress,
        tokenStandard: result.tokenStandard,
        totalSupply: result.totalSupply,
        mintTotal: result.totalSupply,
        mintCount: result.totalSupply,
        avgResaleCapPct: result.avgResaleCapPct,
        avgRoyaltyPct: result.avgRoyaltyPct,
        mintError: null,
        updatedAt: now,
      })
      .where(eq(events.id, eventId))
      .run();
  });
}

function persistMintProgress(eventId: string, mintedCount: number, totalSupply: number): void {
  db.update(events)
    .set({ mintCount: mintedCount, mintTotal: totalSupply, updatedAt: new Date() })
    .where(eq(events.id, eventId))
    .run();
}
