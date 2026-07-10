# Ticket App

Blockchain-based event ticketing platform that eliminates ticket fraud and unauthorized resale ("cambismo") through NFT-backed tickets, programmable resale rules, and cryptographic ownership verification — wrapped in a Web2.5 experience so end users never touch a wallet or a seed phrase.

> **Status:** active MVP development. See [`docs/FEATURE_PLAN.md`](docs/FEATURE_PLAN.md) for feature status and [`docs/roadmap.md`](docs/roadmap.md) for milestones.

---

## Table of contents

- [Problem](#problem)
- [Solution](#solution)
- [How a ticket works](#how-a-ticket-works)
- [Personas](#personas)
- [Architecture](#architecture)
- [Monorepo layout](#monorepo-layout)
- [Getting started](#getting-started)
- [Local on-chain development](#local-on-chain-development)
- [Scripts reference](#scripts-reference)
- [Testing](#testing)
- [Documentation](#documentation)
- [Team](#team)

---

## Problem

Traditional ticketing has four structural weaknesses:

- **Counterfeit tickets** — a barcode or PDF can be copied and used by more than one person.
- **Unauthorized resale (cambismo)** — scalpers buy in bulk and resell far above face value, with no rule enforcing a ceiling.
- **No royalty recovery** — organizers earn nothing when a ticket changes hands on the secondary market.
- **Opaque ownership** — organizers lose visibility into who actually holds a ticket after the first sale.

## Solution

Every ticket is minted as an ERC-721 NFT. Smart contracts — not a spreadsheet — enforce the rules:

- **Authenticity by cryptography** — ownership is verified on-chain, not by a printed code.
- **Resale price caps** — secondary listings cannot exceed a configurable ceiling over face value.
- **Automatic royalties (ERC-2981)** — a percentage of every resale is paid back to the organizer, on-chain, with no manual collection.
- **Burn-on-entry** — the token is destroyed the moment it's validated at the door, making reuse or cloning impossible.
- **Web2.5 UX** — buyers log in with email and password, pay in local currency (Pix/card), and never see a wallet address or a seed phrase. A custodial wallet signs transactions on their behalf.

## How a ticket works

| Layer | What lives here |
|-------|------------------|
| **On-chain** | Tier ID, event reference, face value, current owner, resale price cap, royalty percentage. Minimal and immutable. |
| **Off-chain** | Event title, description, artwork, venue, schedule — anything descriptive that doesn't need to be trustless. |

**Lifecycle:** `mint` → `ownership` (primary sale or resale) → `dynamic QR at the door` → `validation` → `burn`.

The entry QR code is not static: the buyer's app signs a fresh [EIP-712](https://eips.ethereum.org/EIPS/eip-712) message every 10-second window, binding the code to the current on-chain owner. The scanner recovers the signer from that message and compares it against the token's real owner before accepting entry — a screenshot of someone else's QR is cryptographically useless once the window rotates. See [`docs/local-onchain-development.md`](docs/local-onchain-development.md) and the validation service (`apps/api/src/validation/service.ts`) for the full mechanics.

## Personas

| Persona | Role |
|---------|------|
| **Organizer / Producer** | Creates events, configures tiers/resale rules/royalties, mints tickets. |
| **Buyer / Fan** | Buys primary or secondary tickets, holds the dynamic QR, can resell inside the app. |
| **Validator / Door staff** | Scans tickets at entry through the scanner app; the scan checks on-chain ownership and triggers the burn. |

Full descriptions in [`docs/personas.md`](docs/personas.md).

## Architecture

```
┌────────────────┐      ┌──────────────────┐      ┌───────────────────┐
│   apps/web      │      │    apps/api       │      │  packages/contracts│
│  React 19 + Vite│◄────►│ Fastify + Drizzle │◄────►│  Solidity (Hardhat) │
│  Organizer &     │ HTTP │ + BullMQ worker   │ RPC  │  Polygon / Anvil    │
│  buyer web app   │      │ (minting queue)   │      │  TicketFactory      │
└────────────────┘      └──────────────────┘      │  TicketNFT          │
                                  ▲                 │  TicketMarketplace  │
                                  │                 │  MockUSDC           │
┌────────────────┐               │                 └───────────────────┘
│  apps/scanner   │───────────────┘
│ React Native +  │  validates & burns tickets at the door
│ Expo             │
└────────────────┘
```

- Contracts are deployed to **Polygon** (tested locally on an **Anvil** chain and on the **Amoy** testnet).
- The API holds custodial wallets per user (dev-only local signer for local development; see ADRs for the production provider) and executes mint/transfer/burn transactions on behalf of buyers and organizers.
- `packages/shared` holds Zod schemas and types shared between `apps/web`, `apps/api`, and the scanner — including the dynamic QR contract.

Deeper detail: [`docs/architecture/overview.md`](docs/architecture/overview.md) and [`docs/architecture/stack.md`](docs/architecture/stack.md).

## Monorepo layout

```
apps/
  web/           React 19 + Vite + TanStack Router/Query — organizer & buyer web app
  api/           Fastify + Drizzle ORM (SQLite) + BullMQ — REST API and minting worker
  scanner/       React Native + Expo — door validation app
packages/
  contracts/     Solidity contracts, Hardhat config, deploy scripts, contract tests
  shared/        Cross-app types and Zod schemas (events, tickets, dynamic QR, validation)
docs/            Domain glossary, feature specs, architecture decisions, roadmap
```

pnpm workspaces tie everything together (`pnpm-workspace.yaml`); TypeScript is used end-to-end.

## Getting started

Requirements: Node.js ≥ 20, pnpm 10.x, Docker (for local Redis and the local chain).

```bash
git clone <repo-url>
cd ticketapp
pnpm install
```

Copy the API environment file and adjust as needed:

```bash
cp apps/api/.env.example apps/api/.env
```

By default `ONCHAIN_MINTING_ENABLED=false`, which mocks minting so you can run the app without a blockchain at all:

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

This starts the API, the minting worker, and the Vite frontend together. Open **http://localhost:5173**.

## Local on-chain development

To exercise the real Minting Engine, marketplace, and burn flow against real smart contracts (no testnet faucet required), run a local Anvil chain through Docker Compose and deploy the contracts to it. Full walkthrough, including how to reset state and inspect contracts via the Hardhat console, is documented in [`docs/local-onchain-development.md`](docs/local-onchain-development.md).

Quick path:

```bash
docker compose up -d redis anvil
cd packages/contracts && npx hardhat run scripts/deploy.ts --network localhost
# copy the printed addresses into apps/api/.env, set ONCHAIN_MINTING_ENABLED=true
pnpm db:push && pnpm db:seed && pnpm dev
```

A lightweight **block explorer (Otterscan)** is wired up as a Docker Compose service pointed at the local chain — useful for inspecting transactions, contract state, and the burn confirmations described above:

```bash
docker compose up -d otterscan
# open http://localhost:5100
```

## Scripts reference

Root (`package.json`):

| Script | Description |
|--------|-------------|
| `pnpm dev` | Runs the web app, API, and minting worker together |
| `pnpm build` | Builds every workspace package |
| `pnpm typecheck` | Type-checks every workspace package |
| `pnpm db:push` / `db:migrate` / `db:seed` | Manage the API's SQLite schema and seed data |

Per app (`pnpm --filter <name> <script>`):

| App | Useful scripts |
|-----|----------------|
| `@ticket-chain/web` | `dev`, `build`, `preview`, `typecheck` |
| `@ticket-chain/api` | `dev`, `dev:worker`, `test`, `db:generate`, `db:migrate`, `db:seed` |
| `@ticket-chain/contracts` | `build` (Hardhat compile), `test` |
| scanner (Expo) | `start`, `android`, `ios`, `web` |

## Testing

```bash
pnpm --filter @ticket-chain/contracts test   # Solidity contract tests (Hardhat)
pnpm --filter @ticket-chain/api test         # API integration tests (Vitest)
pnpm typecheck                                # Type-checking across the monorepo
```

## Documentation

The `docs/` folder is the source of truth for domain language, architecture decisions, and feature specs:

| Document | Description |
|----------|-------------|
| [`docs/CONTEXT.md`](docs/CONTEXT.md) | Domain glossary — shared vocabulary for the project |
| [`docs/FEATURE_PLAN.md`](docs/FEATURE_PLAN.md) | Master feature tracker and status board |
| [`docs/personas.md`](docs/personas.md) | Detailed persona descriptions |
| [`docs/features/`](docs/features/) | Feature specifications, organized by persona |
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | System architecture (on-chain vs. off-chain layers) |
| [`docs/architecture/stack.md`](docs/architecture/stack.md) | Technology stack rationale |
| [`docs/architecture/adr/`](docs/architecture/adr/) | Architecture Decision Records |
| [`docs/roadmap.md`](docs/roadmap.md) | Milestone-based delivery plan |
| [`docs/local-onchain-development.md`](docs/local-onchain-development.md) | Running the Minting Engine locally against real contracts |

## Team

- [Vinícius Neitzke](https://github.com/Neiwone) |
- [Ruan Tenório](https://github.com/ruantmelo) |
