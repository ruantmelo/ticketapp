# Architecture Overview

This document describes the high-level system architecture, dividing the platform into on-chain and off-chain layers and showing how they interact.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        OFF-CHAIN LAYER                          │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Web Frontend │   │  Scanner App │   │     Backend          │ │
│  │  (React+Vite) │   │  (RN/Expo)   │   │  (Node.js/Nest)      │ │
│  │               │   │              │   │                      │ │
│  │  - Organizer  │   │  - QR scan   │   │  - Auth (OAuth)      │ │
│  │    panel      │   │  - Signature │   │  - Custodial wallet  │ │
│  │  - Marketplace│   │    verify    │   │    management        │ │
│  │  - My tickets │   │  - Burn tx   │   │  - FIAT integration  │ │
│  │  - Dynamic QR │   │  - Offline   │   │  - Event metadata    │ │
│  │    display    │   │    cache     │   │  - Analytics indexer │ │
│  └──────┬───────┘   └──────┬───────┘   │  - Minting orchestr.  │ │
│         │ wagmi/viem       │ viem       │                      │ │
│         │                  │            │  - DB (metadata)     │ │
│         └────────┬─────────┘            │  - Event listener    │ │
│                  │                      └──────────┬───────────┘ │
└──────────────────┼─────────────────────────────────┼───────────┘
                   │                                 │
                   ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ON-CHAIN LAYER                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Ethereum Blockchain (Hardhat dev)              ││
│  │                                                             ││
│  │  ┌─────────────────┐  ┌──────────────────────────────────┐  ││
│  │  │  Ticket NFT     │  │  Marketplace / Transfer          │  ││
│  │  │  Contract       │  │  Logic (in contract or           │  ││
│  │  │                 │  │  marketplace contract)           │  ││
│  │  │  - mint()       │  │                                  │  ││
│  │  │  - ownerOf()    │  │  - price cap enforcement         │  ││
│  │  │  - burn()       │  │  - royalty disbursement          │  ││
│  │  │  - transfer     │  │  - listing / sale                │  ││
│  │  │    w/ rules     │  │                                  │  ││
│  │  └─────────────────┘  └──────────────────────────────────┘  ││
│  │                                                             ││
│  │  Events emitted: Mint, Transfer, Sale, Burn, RoyaltyPaid    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## On-Chain Layer

The on-chain layer consists of Solidity smart contracts deployed on Ethereum (developed and tested using Hardhat). This layer is the **source of truth** for:

- **Ticket existence** — which tickets have been minted and for which event.
- **Ownership** — who currently holds each ticket NFT.
- **Transfer rules** — price cap enforcement and royalty disbursement on resale.
- **Burn status** — whether a ticket has been invalidated (used at the door).

### Key Contracts (per ADR 0008 — Accepted)

| Contract | Deployment | Responsibility |
|----------|------------|----------------|
| **TicketFactory** | Once, at platform setup | Deploys a new `TicketNFT` per event. Stores a registry of all event contracts. Called by the minting engine (F-ORG-02). |
| **TicketMarketplace** | Once, at platform setup | Shared marketplace for all events. Handles secondary-market listings with on-chain escrow: holds NFT during listing, accepts ERC-20 payment, enforces price cap, routes royalty to organizer, pays seller, transfers NFT to buyer — all atomically. |
| **TicketNFT** (ERC-721 + ERC-2981) | Per event, via `TicketFactory` | Represents tickets as unique NFTs. OpenZeppelin-based. Overrides `_update` to restrict transfers to: organizer (primary sale), marketplace (secondary sale), authorized validators (burn). Price cap and royalty are immutable after deployment. |

### Events

The contracts emit events for every state change. These events are indexed by the backend for the analytics dashboard and marketplace state:

- `Mint(eventId, tokenId, tier, faceValue, to)`
- `Transfer(from, to, tokenId)`
- `Sale(tokenId, price, royaltyAmount, organizer)`
- `Burn(tokenId, by)`
- `ListingCreated(tokenId, seller, price)`
- `ListingCancelled(tokenId)`

## Off-Chain Layer

The off-chain layer handles everything that should not or cannot live on-chain: user authentication, FIAT payments, metadata storage, indexing, and the user-facing applications.

### Web Frontend (React + Vite)

Serves two personas via a single web application (or two routes within one app):

- **Organizer panel**: event creation (F-ORG-01), secondary market config (F-ORG-03), analytics dashboard (F-ORG-04).
- **Buyer marketplace**: onboarding (F-BUY-01), browsing/buying/listing (F-BUY-02), ticket display with dynamic QR (F-BUY-04).

Uses **wagmi + viem** for all blockchain interactions (reads, writes, event subscriptions).

### Scanner App (React Native + Expo)

Serves the validator persona. A focused mobile app that:

- Scans dynamic QR codes (F-VAL-01).
- Verifies signatures locally using viem.
- Queries on-chain ownership and burn status.
- Queues burns and caches state for offline operation (F-VAL-02).

### Backend (Node.js / Fastify / NestJS)

The central off-chain service. Responsibilities:

- **Authentication**: email/password. Session management.
- **Custodial wallet management**: creates and manages invisible wallets for buyers. Signs transactions on their behalf. (Provider per ADR 0007.)
- **Minting orchestration**: receives event configs from the organizer panel, constructs and submits deployment + mint transactions.
- **FIAT integration**: receives payment confirmations from Pix/card providers, converts to on-chain value, executes ticket transfers. (F-BUY-03.)
- **Event indexing**: listens to on-chain events and stores them in a database for fast querying by the frontend and analytics dashboard.
- **Metadata storage**: event artwork, descriptions, and user profile data that do not belong on-chain.

### Data Flow Examples

**Primary sale (organizer → buyer):**
1. Buyer selects a ticket in the marketplace (web frontend).
2. Buyer pays via Pix (F-BUY-03). Backend receives payment confirmation.
3. Backend constructs a transfer transaction from the organizer/contract to the buyer's custodial wallet.
4. Backend signs and submits the transaction (on-chain).
5. On-chain: `Transfer` event emitted. Backend indexes it. Frontend updates the buyer's "My Tickets".

**Secondary sale (buyer → buyer):**
1. Seller lists a ticket at a price ≤ cap (frontend → on-chain or backend, per ADR 0008).
2. Buyer selects the listing and pays (FIAT or crypto).
3. On-chain: the marketplace/transfer logic checks the price cap, routes the royalty to the organizer, transfers the NFT to the buyer.
4. `Sale` + `Transfer` events emitted. Backend indexes. Both parties' UIs update.

**Validation at the door:**
1. Buyer opens ticket in app; dynamic QR rotates (F-BUY-04).
2. Validator scans QR (F-VAL-01).
3. Scanner recovers signature, queries on-chain `ownerOf` + burn status.
4. If valid: scanner submits (or queues) a burn transaction. Ticket is invalidated.
5. `Burn` event emitted. Backend indexes for analytics.

## Cross-Cutting Concerns

| Concern | Approach |
|---------|----------|
| **Gas fees** | To be decided (platform-subsidized, baked into ticket price, or gasless relayer). Intersects with ADR 0007 and F-BUY-03. |
| **Security** | Smart contracts audited before mainnet deployment. Custodial wallet keys managed by the provider (ADR 0007). Backend follows standard web security practices (input validation, rate limiting, secrets management). |
| **Scalability** | Ethereum L1 gas costs may be prohibitive for large events. L2/sidechain migration is a future consideration (post-MVP). The architecture is EVM-compatible to allow this. |
| **Privacy (LGPD)** | Buyer demographic data is stored off-chain only. On-chain data is limited to wallet addresses and token ownership. PII handling per LGPD requirements (see F-ORG-04 open questions). |
