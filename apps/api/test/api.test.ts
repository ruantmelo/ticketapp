import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir: string;

beforeEach(() => {
  vi.resetModules();
  tempDir = mkdtempSync(join(tmpdir(), "ticket-api-"));
  const databaseUrl = join(tempDir, "ticket-chain.db");
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.UPLOAD_DIR = join(tempDir, "uploads");
  process.env.JWT_SECRET = "test-secret";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.ONCHAIN_MINTING_ENABLED = "false";
  createSchema(databaseUrl);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("metadata routes", () => {
  it("returns rich ticket metadata from deterministic DB rows", async () => {
    const { buildServer } = await import("../src/app.js");
    const { db } = await import("../src/db/client.js");
    const { events, ticketTiers, ticketTokens, users } = await import("../src/db/schema.js");
    const now = new Date();

    db.insert(users).values({ id: "organizer-1", email: "org@example.com", name: "Org", role: "organizer", passwordHash: "hash", createdAt: now }).run();
    db.insert(events).values({
      id: "event-1",
      organizerId: "organizer-1",
      title: "Festival UFAL",
      description: "Noite principal",
      location: "Maceió",
      startsAt: "2030-01-02T20:00:00.000Z",
      capacity: 10,
      artworkUrl: "http://localhost:4000/uploads/art.png",
      status: "minted",
      contractAddress: "0x0000000000000000000000000000000000000001",
      tokenStandard: "ERC-721",
      totalSupply: 10,
      avgResaleCapPct: 120,
      avgRoyaltyPct: 5,
      createdAt: now,
      updatedAt: now,
    }).run();
    db.insert(ticketTiers).values({ id: "tier-vip", eventId: "event-1", name: "VIP", quantity: 10, faceValue: 5000, resaleCapPct: 120, royaltyPct: 5, createdAt: now }).run();
    db.insert(ticketTokens).values({ id: "event-1:7", eventId: "event-1", tokenId: 7, tierId: "tier-vip", onChainTierId: 1, createdAt: now }).run();

    const app = await buildServer();
    const response = await app.inject({ method: "GET", url: "/metadata/event-1/7" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Festival UFAL #7",
      description: "Noite principal",
      image: "http://localhost:4000/uploads/art.png",
      attributes: expect.arrayContaining([
        { trait_type: "event", value: "Festival UFAL" },
        { trait_type: "tier", value: "VIP" },
        { trait_type: "face value", value: 5000 },
        { trait_type: "date", value: "2030-01-02T20:00:00.000Z" },
        { trait_type: "location", value: "Maceió" },
      ]),
    });
  });
});

describe("minting retry route", () => {
  it("moves mint_failed event back to minting and stores the retry job ID", async () => {
    vi.doMock("../src/services/minting.queue.js", () => ({
      enqueueMintingJob: vi.fn(async () => "queued-job"),
      retryMintingJob: vi.fn(async () => "retry-job"),
      processMintingJob: vi.fn(async () => undefined),
      closeMintingQueue: vi.fn(async () => undefined),
    }));

    const { buildServer } = await import("../src/app.js");
    const { db } = await import("../src/db/client.js");
    const { events, ticketTiers, users } = await import("../src/db/schema.js");
    const { hashPassword } = await import("../src/auth/crypto.js");
    const { eq } = await import("drizzle-orm");
    const now = new Date();

    db.insert(users).values({ id: "organizer-1", email: "org@example.com", name: "Org", role: "organizer", passwordHash: hashPassword("password123"), createdAt: now }).run();
    db.insert(events).values({
      id: "event-1",
      organizerId: "organizer-1",
      title: "Festival UFAL",
      description: "Noite principal",
      location: "Maceió",
      startsAt: "2030-01-02T20:00:00.000Z",
      capacity: 10,
      artworkUrl: null,
      status: "mint_failed",
      tokenStandard: "ERC-721",
      totalSupply: 10,
      avgResaleCapPct: 120,
      avgRoyaltyPct: 5,
      mintJobId: "old-job",
      mintError: "network failed",
      createdAt: now,
      updatedAt: now,
    }).run();
    db.insert(ticketTiers).values({ id: "tier-general", eventId: "event-1", name: "Geral", quantity: 10, faceValue: 1000, resaleCapPct: 120, royaltyPct: 5, createdAt: now }).run();

    const app = await buildServer();
    const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "org@example.com", password: "password123" } });
    const cookie = login.headers["set-cookie"];
    const response = await app.inject({ method: "POST", url: "/events/event-1/minting/retry", headers: { cookie } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "minting", mintError: null });
    const row = db.select().from(events).where(eq(events.id, "event-1")).get();
    expect(row?.status).toBe("minting");
    expect(row?.mintJobId).toBe("retry-job");
    expect(row?.mintError).toBeNull();
  });
});

function createSchema(databaseUrl: string): void {
  const sqlite = new Database(databaseUrl);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      artwork_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      contract_address TEXT,
      token_standard TEXT,
      total_supply INTEGER,
      avg_resale_cap_pct INTEGER,
      avg_royalty_pct INTEGER,
      mint_job_id TEXT,
      mint_error TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE ticket_tiers (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      face_value INTEGER NOT NULL,
      resale_cap_pct INTEGER NOT NULL,
      royalty_pct INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE ticket_tokens (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      token_id INTEGER NOT NULL,
      tier_id TEXT NOT NULL REFERENCES ticket_tiers(id) ON DELETE CASCADE,
      on_chain_tier_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX ticket_tokens_event_token_unique ON ticket_tokens(event_id, token_id);
  `);
  sqlite.close();
}
