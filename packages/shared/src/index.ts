import { z, type ZodError } from "zod";

export const DYNAMIC_QR_VERSION = 1 as const;
export const DYNAMIC_QR_ROTATION_SECONDS = 10 as const;
export const DYNAMIC_QR_WINDOW_TOLERANCE = 1 as const;

const dynamicQrContractSchema = z.object({
  version: z.literal(DYNAMIC_QR_VERSION),
  chainId: z.number().int().positive(),
  contractAddress: z.string(),
  tokenId: z.union([z.number().int().nonnegative(), z.string()]),
  windowIndex: z.number().int().nonnegative(),
});

export const dynamicQrPayloadSchema = dynamicQrContractSchema.extend({
  signature: z.string(),
});

export const dynamicQrContextSchema = z.object({
  version: z.literal(DYNAMIC_QR_VERSION),
  chainId: z.number().int().positive(),
  contractAddress: z.string(),
  tokenId: z.number().int().nonnegative(),
  ownerAddress: z.string(),
  status: z.enum(["owned", "listed", "burned"]),
});

export const validationResultCodeSchema = z.enum([
  "VALID_ACCEPTED",
  "INVALID_SIGNATURE",
  "EXPIRED_QR",
  "NOT_OWNER",
  "ALREADY_USED",
  "UNKNOWN_TICKET",
  "CHAIN_UNAVAILABLE",
  "INVALID_QR",
  "FORBIDDEN_EVENT",
]);

export const validationScanRequestSchema = z.object({
  payload: z.string().optional(),
  qrPayload: z.string().optional(),
}).refine((value) => Boolean(value.payload ?? value.qrPayload), {
  message: "payload ou qrPayload é obrigatório",
});

export const validationScanResponseSchema = z.object({
  status: validationResultCodeSchema,
  message: z.string(),
  ticketId: z.string().optional(),
  eventId: z.string().optional(),
  txHash: z.string().optional(),
});

export const validatorEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  startsAt: z.string(),
});

export type DynamicQrPayload = z.infer<typeof dynamicQrPayloadSchema>;
export type DynamicQrPayloadWithoutSignature = z.infer<typeof dynamicQrContractSchema>;
export type DynamicQrContext = z.infer<typeof dynamicQrContextSchema>;
export type ValidationResultCode = z.infer<typeof validationResultCodeSchema>;
export type ValidationScanRequest = z.infer<typeof validationScanRequestSchema>;
export type ValidationScanResponse = z.infer<typeof validationScanResponseSchema>;
export type ValidatorEvent = z.infer<typeof validatorEventSchema>;

export function getDynamicQrWindowIndex(nowMs = Date.now()): number {
  return Math.floor(nowMs / (DYNAMIC_QR_ROTATION_SECONDS * 1000));
}

export function buildDynamicQrTypedData(input: Omit<DynamicQrPayloadWithoutSignature, "contractAddress"> & { contractAddress: `0x${string}` }) {
  return {
    domain: {
      name: "TicketChainDynamicQR",
      version: "1",
      chainId: input.chainId,
      verifyingContract: input.contractAddress,
    },
    types: {
      TicketAdmission: [
        { name: "version", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "contractAddress", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "windowIndex", type: "uint256" },
      ],
    },
    primaryType: "TicketAdmission" as const,
    message: {
      version: input.version,
      chainId: input.chainId,
      contractAddress: input.contractAddress,
      tokenId: input.tokenId,
      windowIndex: input.windowIndex,
    },
  };
}

export function serializeDynamicQrPayload(payload: DynamicQrPayload): string {
  return JSON.stringify(payload);
}

export function parseDynamicQrPayload(raw: string): DynamicQrPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = dynamicQrPayloadSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isDynamicQrWindowAccepted(windowIndex: number, nowMs = Date.now()): boolean {
  const current = getDynamicQrWindowIndex(nowMs);
  return Math.abs(current - windowIndex) <= DYNAMIC_QR_WINDOW_TOLERANCE;
}

export const VALIDATION = {
  artworkMaxBytes: 5 * 1024 * 1024,
  artworkMimeTypes: ["image/png", "image/jpeg"] as const,
  resaleCapPctMin: 100,
  resaleCapPctMax: 150,
  royaltyPctMin: 0,
  royaltyPctMax: 10,
  faceValueMin: 1,
  quantityMin: 1,
  maxTiers: 10,
} as const;

export const eventStatusSchema = z.enum(["draft", "published", "minting", "minted", "mint_failed"]);
export const tokenStandardSchema = z.literal("ERC-721");
export const userRoleSchema = z.enum(["organizer", "buyer", "validator"]);

export const registerSchema = z.object({
  name: z.string().min(1, "Informe seu nome").max(120),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(200),
  role: userRoleSchema.exclude(["validator"]).default("buyer"),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const ticketTierSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome do tier obrigatório").max(80),
  quantity: z
    .number({ message: "Quantidade inválida" })
    .int("Quantidade deve ser inteira")
    .min(VALIDATION.quantityMin, "Quantidade mínima é 1")
    .max(1_000_000),
  faceValue: z
    .number({ message: "Preço inválido" })
    .int("Preço deve ser inteiro")
    .min(VALIDATION.faceValueMin, "Preço deve ser maior que zero"),
  resaleCapPct: z
    .number({ message: "Cap inválido" })
    .int()
    .min(VALIDATION.resaleCapPctMin, "Cap mínimo é 100%")
    .max(VALIDATION.resaleCapPctMax, "Cap máximo é 150%"),
  royaltyPct: z
    .number({ message: "Royalty inválido" })
    .int("Royalty deve ser inteiro")
    .min(VALIDATION.royaltyPctMin, "Royalty mínimo é 0%")
    .max(VALIDATION.royaltyPctMax, "Royalty máximo é 10%"),
});

const ticketTiersInputSchema = z
  .array(ticketTierSchema)
  .min(1, "Adicione ao menos um tier")
  .max(VALIDATION.maxTiers, `Máximo de ${VALIDATION.maxTiers} tiers`)
  .superRefine((tiers, ctx) => {
    const first = tiers[0];
    if (!first) return;

    for (let index = 1; index < tiers.length; index++) {
      const tier = tiers[index];
      if (!tier) continue;

      if (tier.resaleCapPct !== first.resaleCapPct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "resaleCapPct"],
          message: "Todos os tiers devem usar o mesmo cap de revenda",
        });
      }

      if (tier.royaltyPct !== first.royaltyPct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "royaltyPct"],
          message: "Todos os tiers devem usar o mesmo royalty",
        });
      }
    }
  });

export const eventInputSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  description: z.string().max(5000).default(""),
  location: z.string().min(1, "Local obrigatório").max(300),
  startsAt: z
    .string()
    .min(1, "Data obrigatória")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Data inválida")
    .refine((v) => Date.parse(v) > Date.now(), "A data do evento deve ser futura"),
  capacity: z
    .number({ message: "Capacidade inválida" })
    .int()
    .min(1, "Capacidade mínima é 1")
    .max(1_000_000),
  artworkUrl: z.string().nullable().default(null),
  tiers: ticketTiersInputSchema,
});

export const detalhesSchema = eventInputSchema.pick({
  title: true,
  description: true,
  location: true,
  startsAt: true,
  capacity: true,
  artworkUrl: true,
});

export const ingressosSchema = eventInputSchema.pick({ tiers: true });

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
});

export const authSessionSchema = z.object({ user: userSchema });

const eventCoreSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  startsAt: z.string(),
  capacity: z.number(),
  artworkUrl: z.string().nullable(),
  tiers: z.array(ticketTierSchema),
});

export const eventDraftSchema = eventCoreSchema.extend({
  status: z.literal("draft"),
});

export const eventPublishedSchema = eventCoreSchema.extend({
  status: z.enum(["published", "minting", "minted", "mint_failed"]),
  contractAddress: z.string(),
  tokenStandard: tokenStandardSchema,
  totalSupply: z.number(),
  mintProgress: z.object({
    mintedCount: z.number(),
    totalSupply: z.number(),
    percent: z.number(),
  }),
  avgResaleCapPct: z.number(),
  avgRoyaltyPct: z.number(),
  organizerId: z.string(),
  mintError: z.string().nullable(),
});

export const eventSchema = z.discriminatedUnion("status", [
  eventDraftSchema,
  eventPublishedSchema,
]);

export const eventListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  location: z.string(),
  ticketCount: z.number(),
  status: eventStatusSchema,
});

export const onChainPreviewSchema = z.object({
  tokenStandard: tokenStandardSchema,
  contractAddress: z.string(),
  totalSupply: z.number(),
  avgResaleCapPct: z.number(),
  avgRoyaltyPct: z.number(),
  royaltyReceiver: z.string(),
});

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type TokenStandard = z.infer<typeof tokenStandardSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type TicketTier = z.infer<typeof ticketTierSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;
export type DetalhesInput = z.infer<typeof detalhesSchema>;
export type IngressosInput = z.infer<typeof ingressosSchema>;
export type EventBase = z.infer<typeof eventCoreSchema>;
export type EventDraft = z.infer<typeof eventDraftSchema>;
export type EventPublished = z.infer<typeof eventPublishedSchema>;
export type Event = z.infer<typeof eventSchema>;
export type EventListItem = z.infer<typeof eventListItemSchema>;
export type OnChainPreview = z.infer<typeof onChainPreviewSchema>;

export type AuthErrorCode = "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "UNAUTHORIZED" | "VALIDATION";
export type ApiErrorCode = AuthErrorCode | "NOT_FOUND" | "FORBIDDEN" | "INTERNAL" | "WALLET_NOT_READY" | "WALLET_SIGNATURE_UNAVAILABLE" | "INVALID_STATUS" | "CHAIN_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
