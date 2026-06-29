import {
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { env } from "../config.js";

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!salt || !expectedHex) return false;
  const saltBuf = Buffer.from(salt, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  const derived = pbkdf2Sync(password, saltBuf, iterations, expected.length, DIGEST);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
}

export function signToken(payload: Omit<JwtPayload, "iat">): string {
  const iat = Math.floor(Date.now() / 1000);
  const body: JwtPayload = { ...payload, iat };
  const headerB64 = base64urlJson({ alg: "HS256", typ: "JWT" });
  const payloadB64 = base64urlJson(body);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac("sha256", env.jwtSecret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signature] = parts as [string, string, string];
  const signingInput = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", env.jwtSecret)
    .update(signingInput)
    .digest("base64url");
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    return JSON.parse(base64urlDecode(payloadB64)) as JwtPayload;
  } catch {
    return null;
  }
}

function base64urlJson(value: unknown): string {
  return base64urlEncode(Buffer.from(JSON.stringify(value)));
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
