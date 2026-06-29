import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
  status: text("status", { enum: ["draft", "published", "minting", "minted"] })
    .notNull()
    .default("draft"),
  contractAddress: text("contract_address"),
  tokenStandard: text("token_standard", { enum: ["ERC-721"] }),
  totalSupply: integer("total_supply"),
  avgResaleCapPct: integer("avg_resale_cap_pct"),
  avgRoyaltyPct: integer("avg_royalty_pct"),
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

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  tiers: many(ticketTiers),
}));

export const ticketTiersRelations = relations(ticketTiers, ({ one }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type UserRole = (typeof userRoles)[number];
export type EventRow = typeof events.$inferSelect;
export type TicketTierRow = typeof ticketTiers.$inferSelect;
