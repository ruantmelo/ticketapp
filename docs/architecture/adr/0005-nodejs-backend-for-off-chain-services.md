# ADR 0005: Node.js (Fastify / NestJS) for Backend

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

The platform requires an off-chain backend to handle: user authentication (email/password), custodial wallet management, minting orchestration, FIAT payment integration (Pix + card), on-chain event indexing, and metadata storage. The backend must interact with Polygon (listen to events, submit transactions via the custodial wallet) and serve data to the web frontend and scanner app.

## Considered Options

### Option 1: Node.js (Fastify or NestJS)
- **Pros**: TypeScript end-to-end — shared types with the frontend (React) and contract ABIs; excellent ecosystem for blockchain interaction (viem/ethers run natively in Node); strong WebSocket support for real-time event listening; NestJS provides structured architecture (modules, DI) for a growing service (and can run on Fastify under the hood); Fastify is a high-performance, schema-based framework sufficient for a minimal MVP; large developer pool.
- **Cons**: Single-threaded (fine for I/O-bound blockchain work, but CPU-heavy tasks like signature batching may need worker threads); less suited for data-science-heavy analytics processing.

### Option 2: Python (FastAPI)
- **Pros**: Excellent for data indexing and analytics (pandas, numpy); strong async support via FastAPI; good blockchain libraries (web3.py).
- **Cons**: Different language from the frontend (no shared types); fragments the team's tooling; web3.py is less TypeScript-integrated than viem in a TS codebase.

### Option 3: The Graph (subgraph) + serverless functions
- **Pros**: Decentralized indexing; no backend to maintain for event data; GraphQL API out of the box.
- **Cons**: The Graph only handles indexing — authentication, custodial wallets, and FIAT integration still need a traditional backend; adds a dependency on a hosted service or self-hosted Graph node; less flexible for custom off-chain logic.

## Decision

We choose **Node.js** as the backend runtime. The framework choice (Fastify vs NestJS) is deferred to implementation — Fastify for a minimal MVP, NestJS (optionally on the Fastify adapter) if structured modularity is needed early.

## Rationale

- TypeScript end-to-end is a significant advantage: contract ABIs, event types, and API contracts types can be shared between frontend and backend, reducing integration errors.
- Node.js is the natural environment for viem (ADR 0004) on the server side — the same library used in the frontend can be used for event listening and transaction signing in the backend.
- The backend's primary workload is I/O-bound (blockchain RPC calls, payment webhooks, database queries, WebSocket event streams), which is Node.js's strength.
- FIAT payment providers (Pix gateways, card processors) have well-documented Node.js SDKs.

## Consequences

- The backend is a Node.js application, written in TypeScript.
- viem is used for all blockchain interactions on the server (event listening, contract reads/writes, transaction signing via custodial wallet).
- A database (e.g., PostgreSQL) is used for off-chain metadata, indexed events, and user profiles. The specific database choice is an implementation detail.
- If analytics processing becomes CPU-intensive, a separate data-processing service (potentially Python) can be added later without changing this decision.
