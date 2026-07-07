# ADR 0004: wagmi + viem for Web3 Client

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

The web frontend (React + Vite, per ADR 0003) needs to interact with Polygon: read contract state (ticket ownership, listings, burn status), submit transactions (purchases, listings, burns), and subscribe to events. We need a Web3 client library that integrates well with React and provides strong TypeScript support.

## Considered Options

### Option 1: wagmi + viem
- **Pros**: wagmi provides React hooks (`useReadContract`, `useWriteContract`, `useAccount`, etc.) that integrate naturally with React components; viem is a modern, TypeScript-first Ethereum client that underpins wagmi — it has excellent type safety, modular APIs, and is actively maintained; together they are the current best-in-class React Web3 stack; viem is significantly faster and lighter than ethers.js; both are from the same team and designed to work together.
- **Cons**: Newer than ethers.js — fewer legacy tutorials and Stack Overflow answers; some third-party tooling still defaults to ethers.js.

### Option 2: ethers.js + Web3Modal
- **Pros**: ethers.js is the most widely used Ethereum library; massive tutorial base; compatible with nearly all Web3 tooling.
- **Cons**: Heavier and slower than viem; weaker TypeScript support; no built-in React hooks (requires custom integration or a wrapper); Web3Modal is wallet-connect-focused and less flexible than wagmi's hook model.

### Option 3: web3.js
- **Pros**: Older, historically popular.
- **Cons**: Largely superseded by ethers.js and viem; weakest TypeScript support; less actively maintained; not recommended for new projects.

## Decision

We choose **wagmi + viem** for all blockchain interactions in the web frontend.

## Rationale

- wagmi's React hooks model is the most ergonomic way to integrate blockchain reads/writes into React components.
- viem's TypeScript-first design provides compile-time safety for contract ABIs, function signatures, and return types — reducing runtime errors.
- The two libraries are designed by the same team to work together, ensuring compatibility.
- viem's modular architecture and performance are superior to ethers.js for our use case (frequent reads for marketplace state, ticket display, and dynamic QR signing).
- RainbowKit or ConnectKit can be layered on top of wagmi if wallet connection UI is needed (though for the MVP, the custodial wallet model may not require a wallet picker — see ADR 0007).

## Consequences

- All blockchain reads and writes in the web frontend use wagmi hooks backed by viem.
- Contract ABIs are imported as TypeScript types for type-safe interactions.
- The scanner app (ADR 0006) can also use viem (without wagmi, since it is not React-web) for signature verification and contract reads.
- Developers should reference the wagmi and viem documentation rather than ethers.js tutorials.
