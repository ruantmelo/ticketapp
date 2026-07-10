import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { users, type UserRole } from "./db/schema.js";
import { hashPassword } from "./auth/crypto.js";
import { createCustodialWalletForUser } from "./services/custodial-wallet.service.js";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const SEED_USERS: SeedUser[] = [
  { name: "Organizador Demo", email: "organizador@ticketapp.com", password: "organizador123", role: "organizer" },
  { name: "Produtora Cultural", email: "produtora@ticketapp.com", password: "produtora123", role: "organizer" },
  { name: "João Organizador", email: "joao@ticketapp.com", password: "joao12345", role: "organizer" },
  { name: "Maria Produtora", email: "maria@ticketapp.com", password: "maria12345", role: "organizer" },
  { name: "Alice Compradora", email: "alice@ticketapp.com", password: "alice12345", role: "buyer" },
  { name: "Validador Demo", email: "validador@ticketapp.com", password: "validador123", role: "validator" },
];

async function seed(): Promise<void> {
  let inserted = 0;
  let skipped = 0;

  for (const seedUser of SEED_USERS) {
    const existing = db.select().from(users).where(eq(users.email, seedUser.email)).get();
    if (existing) {
      skipped++;
      continue;
    }

    const id = randomUUID();
    const passwordHash = hashPassword(seedUser.password);
    db.insert(users)
      .values({
        id,
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        passwordHash,
        createdAt: new Date(),
      })
      .run();
    if (seedUser.role === "buyer") await createCustodialWalletForUser(id);
    inserted++;
  }

  const total = db.select().from(users).all().length;
  console.log(`Seed completo: ${inserted} usuários inseridos, ${skipped} já existiam (total: ${total}).`);
  console.log("\nCredenciais de acesso:");
  for (const u of SEED_USERS) {
    console.log(`  ${u.email} / ${u.password}`);
  }
}

seed().catch((err) => {
  console.error("Erro ao executar seed:", err);
  process.exit(1);
});
