# Technology Stack

This document summarizes the chosen technology stack and links to the Architecture Decision Records (ADRs) that justify each choice.

## Stack Summary

| Layer | Technology | ADR | Status |
|-------|------------|-----|--------|
| Smart contract language | Solidity | [0002](adr/0002-ethereum-hardhat-for-contracts.md) | Accepted |
| Contract framework / dev network | Hardhat | [0002](adr/0002-ethereum-hardhat-for-contracts.md) | Accepted |
| Target blockchain | Polygon PoS | [0011](adr/0011-polygon-for-mvp-network.md) | Accepted |
| Web frontend framework | React + Vite | [0003](adr/0003-react-vite-for-web-frontend.md) | Accepted |
| Web3 client library | wagmi + viem | [0004](adr/0004-wagmi-viem-for-web3-client.md) | Accepted |
| Backend runtime / framework | Node.js (Fastify / NestJS) | [0005](adr/0005-nodejs-backend-for-off-chain-services.md) | Accepted |
| Scanner app framework | React Native + Expo | [0006](adr/0006-react-native-expo-for-scanner.md) | Accepted |
| Custodial wallet provider | _To be decided_ | [0007](adr/0007-custodial-wallet-provider.md) | Proposed |
| NFT standard / royalties / transfer restrictions | ERC-721 (OpenZeppelin) + ERC-2981 + dedicated marketplace (on-chain escrow) | [0008](adr/0008-nft-standard-and-royalties.md) | Accepted |
| Dynamic QR signing scheme | _To be decided_ | [0009](adr/0009-dynamic-qr-signing-scheme.md) | Proposed |
| Offline validation mechanism | _To be decided_ | [0010](adr/0010-offline-validation-mechanism.md) | Proposed |

## Rationale Summary

### Smart Contracts: Solidity + Hardhat on Polygon
Solidity is the dominant smart contract language with the largest ecosystem, tooling, and audit support. Hardhat offers a mature local dev network, compilation, testing, and deployment pipeline. Polygon PoS keeps EVM compatibility while lowering transaction costs for minting, secondary-market escrow, and burn-on-validation.

### Web Frontend: React + Vite
React has the largest component ecosystem and developer pool. Vite provides fast HMR and a lightweight build without SSR complexity — appropriate for a client-side Web3 app where blockchain state is the source of truth, not server-rendered HTML.

### Web3 Client: wagmi + viem
wagmi provides React hooks for blockchain interactions (reads, writes, event subscriptions) that integrate naturally with React components. viem is a modern, TypeScript-first Ethereum client that underpins wagmi and offers excellent type safety and modular APIs. Together they are the current best-in-class React Web3 stack.

### Backend: Node.js (Fastify / NestJS)
TypeScript end-to-end (shared types with the frontend and contract ABIs). Node.js is well-suited for blockchain event listening and high-concurrency I/O. NestJS provides structure for a growing backend (optionally on the Fastify adapter); Fastify is a high-performance, schema-based framework sufficient for a minimal MVP. The choice between them is a later implementation detail.

### Scanner App: React Native + Expo
React Native enables cross-platform (iOS + Android) development from a single TypeScript codebase, sharing skills and some utilities with the web team. Expo simplifies camera access, QR scanning, and over-the-air updates — critical for an app that door staff must use reliably without manual installs.

## Open Decisions

Three ADRs remain in **Proposed** status and must be resolved before their associated milestones:

1. **ADR 0007 — Custodial wallet provider** (needed for M3): determines how invisible wallets are created and managed.
2. **ADR 0009 — Dynamic QR signing scheme** (needed for M4): determines the QR payload structure, signing algorithm, and rotation interval.
3. **ADR 0010 — Offline validation mechanism** (needed for M4): determines the cache/snapshot strategy for offline scanning.

See the [roadmap](../roadmap.md) for which milestone resolves each ADR.
