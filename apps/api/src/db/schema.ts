import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const userRoles = ["organizer", "buyer", "validator"] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("buyer"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  organizerId: text("organizer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  location: text("location").notNull(),
  startsAt: text("starts_at").notNull(),
  capacity: integer("capacity").notNull(),
  artworkUrl: text("artwork_url"),
  status: text("status", { enum: ["draft", "published", "minting", "minted", "mint_failed"] })
    .notNull()
    .default("draft"),
  contractAddress: text("contract_address"),
  tokenStandard: text("token_standard", { enum: ["ERC-721"] }),
  totalSupply: integer("total_supply"),
  mintTotal: integer("mint_total"),
  mintCount: integer("mint_count"),
  avgResaleCapPct: integer("avg_resale_cap_pct"),
  avgRoyaltyPct: integer("avg_royalty_pct"),
  mintJobId: text("mint_job_id"),
  mintError: text("mint_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
});

export const ticketTiers = sqliteTable("ticket_tiers", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  faceValue: integer("face_value").notNull(),
  resaleCapPct: integer("resale_cap_pct").notNull(),
  royaltyPct: integer("royalty_pct").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
});

export const ticketTokenStatuses = ["available", "owned", "listed", "burned"] as const;

export const ticketTokens = sqliteTable("ticket_tokens", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  tokenId: integer("token_id").notNull(),
  tierId: text("tier_id")
    .notNull()
    .references(() => ticketTiers.id, { onDelete: "cascade" }),
  onChainTierId: integer("on_chain_tier_id").notNull(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status", { enum: ticketTokenStatuses }).notNull().default("available"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
}, (table) => ({
  eventTokenUnique: uniqueIndex("ticket_tokens_event_token_unique").on(table.eventId, table.tokenId),
}));

export const listingStatuses = ["active", "sold", "cancelled"] as const;

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  ticketTokenId: text("ticket_token_id")
    .notNull()
    .references(() => ticketTokens.id, { onDelete: "cascade" }),
  sellerId: text("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  priceReais: integer("price_reais").notNull(),
  onChainListingId: integer("on_chain_listing_id"),
  status: text("status", { enum: listingStatuses }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(new Date(0)),
});

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  tiers: many(ticketTiers),
}));

export const ticketTiersRelations = relations(ticketTiers, ({ one }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
}));

export const ticketTokensRelations = relations(ticketTokens, ({ one, many }) => ({
  event: one(events, { fields: [ticketTokens.eventId], references: [events.id] }),
  tier: one(ticketTiers, { fields: [ticketTokens.tierId], references: [ticketTiers.id] }),
  owner: one(users, { fields: [ticketTokens.ownerUserId], references: [users.id] }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  ticketToken: one(ticketTokens, { fields: [listings.ticketTokenId], references: [ticketTokens.id] }),
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type UserRole = (typeof userRoles)[number];
export type EventRow = typeof events.$inferSelect;
export type TicketTierRow = typeof ticketTiers.$inferSelect;
export type TicketTokenRow = typeof ticketTokens.$inferSelect;
export type TicketTokenStatus = (typeof ticketTokenStatuses)[number];
export type ListingRow = typeof listings.$inferSelect;
export type ListingStatus = (typeof listingStatuses)[number];
