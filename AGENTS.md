# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

Blockchain-based event ticketing platform that eliminates ticket fraud and unauthorized resale (cambismo) using NFT-backed tickets, programmable royalties, and cryptographic ownership verification. Web2.5 layer (custodial wallets, FIAT payments) hides blockchain complexity from end users.

**Status:** Planning phase — no code written yet. Docs live in `docs/` and are the source of truth.

## Documentation Map

Read these before making changes. They define the language, architecture, and decisions that code must follow.

- `docs/CONTEXT.md` — Domain glossary. Use these exact terms in code, comments, docs, and commits (e.g., `primary sale`, `secondary market`, `cambismo`, `face value`, `price cap`, `royalty`, `burn`, `custodial wallet`, `dynamic QR`, `scanner app`). Do not invent synonyms.
- `docs/README.md` — Project overview + specs index.
- `docs/personas.md` — Three personas: **Organizer/Producer**, **Buyer/Fan**, **Validator/Door Staff**. Treat `Organizer`/`Producer`, `Buyer`/`Fan`, and `Validator`/`Door Staff`/`Staff` as interchangeable.
- `docs/FEATURE_PLAN.md` — Master feature tracker. Each feature has an ID (`F-ORG-01`, `F-BUY-02`, `F-VAL-01`, etc.); reference these IDs in commit messages and PRs.
- `docs/features/` — Feature specs organized by persona.
- `docs/architecture/overview.md` — System architecture (on-chain vs off-chain layers, data flow).
- `docs/architecture/stack.md` — Technology stack summary with rationale.
- `docs/architecture/adr/` — Architecture Decision Records. Decisions are **Accepted** or **Proposed**. Do not contradict an Accepted ADR in code; propose a new ADR instead.
- `docs/roadmap.md` — Five milestones (M1→M5) with dependency graph. Respect milestone ordering and the M1→M2→M3→(M4‖M5) dependency graph.

## Technology Stack (per ADRs)

| Layer | Technology | ADR |
|-------|------------|-----|
| Smart contracts | Solidity, Hardhat (Ethereum L1) | 0002, 0008 |
| Web frontend | React + Vite | 0003 |
| Web3 client | wagmi + viem | 0004 |
| Backend | Node.js (Fastify / NestJS), TypeScript | 0005 |
| Scanner app | React Native + Expo | 0006 |
| Custodial wallet provider | _To be decided_ | 0007 |
| NFT standard / royalties / transfers | ERC-721 (OpenZeppelin) + ERC-2981 + dedicated marketplace (on-chain escrow) | 0008 |
| Dynamic QR signing scheme | _To be decided_ | 0009 |
| Offline validation mechanism | _To be decided_ | 0010 |

**Key constraints from ADRs:**
- TypeScript end-to-end; share types between frontend, backend, and contract ABIs.
- All blockchain interactions use **viem** (not ethers) — server-side and client-side.
- Backend is I/O-bound (RPC calls, payment webhooks, DB queries, WebSocket streams) — Fastify for a minimal MVP; NestJS (optionally on the Fastify adapter) if structured modularity is needed.
- Ethereum L1 for highest security; EVM-compatibility kept for potential future L2 migration.
- Direct P2P transfers are **blocked** — all resale goes through a dedicated marketplace contract with on-chain escrow.

## Code Conventions

- **Language:** TypeScript everywhere (frontend, backend, scanner app). Solidity for contracts.
- **Naming:** Use the domain terms from `docs/CONTEXT.md` verbatim in identifiers, file names, and API contracts (e.g., `FaceValue`, `PriceCap`, `Royalty`, `CustodialWallet`, `DynamicQR`, `SecondaryMarket`).
- **Comments:** Do not add comments unless explicitly requested.
- **Shared types:** Place shared ABI types, event types, and API contracts in a shared location so frontend and backend import them — do not duplicate type definitions across surfaces.
- **New dependencies:** Do not assume a library is available. Check the stack/ADRs before introducing a framework or SDK (e.g., use viem, not ethers; use Fastify, not Express).

## Architecture Rules

- Keep **on-chain** logic (enforcement, ownership, transfer rules) in smart contracts; keep **off-chain** logic (auth, metadata, indexing, FIAT) in the backend.
- The contract enforces: mint, transfer restrictions (price cap), royalty routing (ERC-2981 + enforced marketplace), and burn-on-validation. Off-chain code may **orchestrate** but must not duplicate enforcement.
- **Never expose or log secrets** — custodial wallet private keys, session secrets, or payment provider credentials. Custodial wallets are managed server-side; users never see seeds or addresses.
- Preserve modularity by milestone: M1 is contract-only; M2 adds frontend+backend orchestration; M3 adds custodial wallets and marketplace; M4 adds dynamic QR + scanner; M5 adds FIAT + analytics. Do not pull in features from a later milestone early.

## Verification Commands

The project uses a **pnpm workspaces monorepo** (`apps/api`, `apps/web`, `packages/shared`).

- **Typecheck (all workspaces):** `pnpm -r typecheck`
- **Build (all workspaces):** `pnpm -r build`
- **Dev (API + Web in parallel):** `pnpm dev` (API on :4000, Web on :5173 with `/api` proxy)
- **Backend DB (SQLite + Drizzle):** `pnpm db:push` (push schema), `pnpm db:generate` (generate migrations)
- **Contracts:** `npx hardhat compile`, `npx hardhat test` (once contract workspace is added)

### Running the stack locally
1. Copy `apps/api/.env.example` → `apps/api/.env`
2. `pnpm install` then `pnpm db:push` (creates `apps/api/data/ticket-chain.db`)
3. `pnpm dev` — the Vite dev server proxies `/api/*` → `localhost:4000` and `/uploads/*` → `localhost:4000` (same-origin for httpOnly cookies)

## Workflow

1. **Read first.** Before implementing, read the relevant feature spec(s) in `docs/features/` and the ADRs touching the feature.
2. **Respect the ADRs.** If you believe a decision should change, open a new ADR rather than silently deviating.
3. **Reference feature IDs** (`F-...`) in commits and PRs.
4. **Update status.** When a feature begins or completes, update `docs/FEATURE_PLAN.md`.
5. **Do not commit** unless explicitly asked. Do not push or open PRs unless explicitly asked.
6. **Verify** with the appropriate test/typecheck/lint command before declaring done once tooling exists.