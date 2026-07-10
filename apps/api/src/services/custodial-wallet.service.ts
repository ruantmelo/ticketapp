import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { createWalletClient, http, type WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { env, localCustodyMasterKey } from "../config.js";
import { db } from "../db/client.js";
import { custodialWallets, users } from "../db/schema.js";
import { TICKETING_CHAIN } from "./minting.service.js";

function deriveKey(): Buffer {
  return createHash("sha256").update(String(localCustodyMasterKey)).digest();
}

function encryptPrivateKey(privateKey: `0x${string}`) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  return { encryptedPrivateKey: encrypted.toString("hex"), encryptionNonce: nonce.toString("hex"), encryptionTag: cipher.getAuthTag().toString("hex") };
}

function decryptPrivateKey(row: { encryptedPrivateKey: string; encryptionNonce: string; encryptionTag: string }) {
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), Buffer.from(row.encryptionNonce, "hex"));
  decipher.setAuthTag(Buffer.from(row.encryptionTag, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(row.encryptedPrivateKey, "hex")), decipher.final()]);
  return decrypted.toString("utf8") as `0x${string}`;
}

export function ensureLocalCustodyAllowed(): void {
  if (env.custodialWalletProvider !== "local-dev") throw new Error("Unsupported custodial wallet provider");
  if (env.nodeEnv === "production") throw new Error("local-dev custodial wallet provider is not allowed in production");
  if (env.chainId === 31337) return;
  if (env.chainId === 80002 && env.allowTestnetLocalCustody) return;
  throw new Error("local-dev custodial wallet provider is only allowed on chainId 31337");
}

export function validateLocalCustodyConfig(): void {
  if (!env.allowLocalCustodialProvider && env.custodialWalletProvider === "local-dev") {
    throw new Error("local-dev custodial wallet provider is disabled");
  }
  if (env.nodeEnv === "production" && env.allowPrivateKeyBootstrap) {
    throw new Error("ALLOW_PRIVATE_KEY_BOOTSTRAP is not allowed in production");
  }
  if (env.allowPrivateKeyBootstrap && !env.localCustodyMasterKey) {
    throw new Error("LOCAL_CUSTODY_MASTER_KEY is required when ALLOW_PRIVATE_KEY_BOOTSTRAP is enabled");
  }
  if (env.custodialWalletProvider === "local-dev") ensureLocalCustodyAllowed();
}

export async function createCustodialWalletForUser(userId: string) {
  ensureLocalCustodyAllowed();
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error("User not found");
  const existing = db.select().from(custodialWallets).where(eq(custodialWallets.userId, userId)).get();
  if (existing) return existing;

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const encrypted = encryptPrivateKey(privateKey);
  const row = {
    id: randomUUID(),
    userId,
    provider: env.custodialWalletProvider,
    providerWalletId: `local-dev:${userId}`,
    address: account.address,
    ...encrypted,
    keyVersion: 1,
    status: "active" as const,
    createdAt: new Date(),
  };
  db.insert(custodialWallets).values(row).run();
  return row;
}

export function getCustodialWalletAddress(userId: string): string {
  const row = db.select().from(custodialWallets).where(eq(custodialWallets.userId, userId)).get();
  if (!row) throw new Error("Custodial wallet not found");
  return row.address;
}

export async function getCustodialWalletAccount(userId: string): Promise<{ account: ReturnType<typeof privateKeyToAccount>; client: WalletClient }> {
  const row = db.select().from(custodialWallets).where(eq(custodialWallets.userId, userId)).get();
  if (!row) throw new Error("Custodial wallet not found");
  const account = privateKeyToAccount(decryptPrivateKey(row));
  const client = createWalletClient({ account, chain: TICKETING_CHAIN, transport: http(env.chainRpcUrl) });
  return { account, client };
}

export function getDevOnlyPrivateKeyForUser(userId: string): `0x${string}` {
  ensureLocalCustodyAllowed();
  const row = db.select().from(custodialWallets).where(eq(custodialWallets.userId, userId)).get();
  if (!row) throw new Error("Custodial wallet not found");
  return decryptPrivateKey(row);
}
