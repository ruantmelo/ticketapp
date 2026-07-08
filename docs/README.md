# Blockchain Ticketing Platform

A blockchain-based event ticketing platform that eliminates ticket fraud and unauthorized resale (cambismo) through NFT-backed tickets, programmable royalties, and cryptographic ownership verification.

## Problem

Traditional ticketing suffers from:
- **Counterfeit tickets** — buyers cannot verify authenticity before entry.
- **Unauthorized resale (cambismo)** — scalpers buy in bulk and resell at inflated prices with no benefit to the producer.
- **No royalty recovery** — producers earn nothing from the secondary market.
- **Opaque data** — organizers have no visibility into who holds tickets or how they circulate.

## Solution

Each ticket is minted as a non-fungible token (NFT) on Polygon. Smart contracts enforce:
- **Authenticity by mathematics** — ownership is verified on-chain, not by a printed barcode.
- **Price caps on resale** — secondary market listings cannot exceed a configurable ceiling.
- **Programmatic royalties** — a percentage of every resale returns to the organizer.
- **Burn-on-entry** — tickets are invalidated after scanning, preventing reuse.

A Web2.5 layer (custodial wallets, FIAT payments) hides blockchain complexity from end users.

## Personas

| Persona | Role | See |
|---------|------|-----|
| **Organizer / Producer** | Creates events, mints tickets, sets resale rules and royalties | [personas.md](personas.md) |
| **Buyer / Fan** | Purchases primary or secondary tickets, holds dynamic QR | [personas.md](personas.md) |
| **Validator / Door Staff** | Scans tickets at entry, verifies on-chain ownership | [personas.md](personas.md) |

## Documentation Index

| Document | Description |
|----------|-------------|
| [CONTEXT.md](CONTEXT.md) | Domain glossary — shared language for the project |
| [FEATURE_PLAN.md](FEATURE_PLAN.md) | Master feature tracker and status board |
| [personas.md](personas.md) | Detailed persona descriptions |
| [features/](features/) | Feature specification documents, organized by persona |
| [architecture/overview.md](architecture/overview.md) | System architecture (on-chain vs off-chain layers) |
| [architecture/stack.md](architecture/stack.md) | Technology stack summary |
| [architecture/adr/](architecture/adr/) | Architecture Decision Records |
| [roadmap.md](roadmap.md) | Milestone-based delivery plan |
| [local-onchain-development.md](local-onchain-development.md) | Run the Minting Engine locally with Hardhat contracts |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart contracts | Solidity, Hardhat (Polygon PoS) |
| Web frontend | React + Vite |
| Web3 client | wagmi + viem |
| Backend | Node.js (Fastify / NestJS) |
| Scanner app | React Native + Expo |

See [architecture/stack.md](architecture/stack.md) for rationale and [architecture/adr/](architecture/adr/) for decision records.

## Local on-chain development

To test event creation and real minting without Polygon Amoy faucet tokens, use the Hardhat local flow in [local-onchain-development.md](local-onchain-development.md).

## Status

This project is in active MVP development. See [FEATURE_PLAN.md](FEATURE_PLAN.md) for the current feature status and [roadmap.md](roadmap.md) for delivery milestones.
