import { z, type ZodError } from "zod";

export const VALIDATION = {
  artworkMaxBytes: 5 * 1024 * 1024,
  artworkMimeTypes: ["image/png", "image/jpeg"] as const,
  resaleCapPctMin: 100,
  resaleCapPctMax: 200,
  royaltyPctMin: 0,
  royaltyPctMax: 25,
  faceValueMin: 0,
  quantityMin: 1,
  maxTiers: 10,
} as const;

export const eventStatusSchema = z.enum(["draft", "published", "minting", "minted"]);
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
    .min(VALIDATION.faceValueMin, "Preço deve ser positivo"),
  resaleCapPct: z
    .number({ message: "Cap inválido" })
    .int()
    .min(VALIDATION.resaleCapPctMin, "Cap mínimo é 100%")
    .max(VALIDATION.resaleCapPctMax, "Cap máximo é 200%"),
  royaltyPct: z
    .number({ message: "Royalty inválido" })
    .min(VALIDATION.royaltyPctMin, "Royalty mínimo é 0%")
    .max(VALIDATION.royaltyPctMax, "Royalty máximo é 25%"),
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
  tiers: z
    .array(ticketTierSchema)
    .min(1, "Adicione ao menos um tier")
    .max(VALIDATION.maxTiers, `Máximo de ${VALIDATION.maxTiers} tiers`),
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
  status: z.enum(["published", "minting", "minted"]),
  contractAddress: z.string(),
  tokenStandard: tokenStandardSchema,
  totalSupply: z.number(),
  avgResaleCapPct: z.number(),
  avgRoyaltyPct: z.number(),
  organizerId: z.string(),
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
export type ApiErrorCode = AuthErrorCode | "NOT_FOUND" | "FORBIDDEN" | "INTERNAL";

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
