# ADR 0003: React + Vite for Web Frontend

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

The platform needs a web frontend serving two personas: the organizer (event creation panel, analytics dashboard) and the buyer (marketplace, ticket display with dynamic QR). The frontend must integrate with blockchain via a Web3 client library and provide a smooth, app-like experience.

## Considered Options

### Option 1: React + Vite (SPA)
- **Pros**: React has the largest component ecosystem and developer pool; Vite provides extremely fast HMR and a lightweight build; SPA model fits a Web3 app where blockchain state is the source of truth (not server-rendered HTML); no SSR complexity; wagmi is built for React.
- **Cons**: No server-side rendering (worse initial SEO, but SEO is not a priority for an authenticated app); client-side routing only.

### Option 2: Next.js (React meta-framework)
- **Pros**: SSR/SSG for better initial load and SEO; API routes for a lightweight backend; large ecosystem.
- **Cons**: SSR adds complexity for a Web3 app (hydration of blockchain state is non-trivial); the backend is already handled by a separate Node.js service (ADR 0005), making Next.js API routes redundant; heavier framework overhead.

### Option 3: Vue 3 + Vite
- **Pros**: Excellent DX, smaller bundle size, growing ecosystem.
- **Cons**: Smaller Web3 library ecosystem than React; wagmi/viem are React-first; fewer Web3-specific component libraries.

## Decision

We choose **React + Vite** as a single-page application.

## Rationale

- The platform is an authenticated, interactive application — SEO is not a priority.
- Blockchain state (ownership, listings, burn status) is the source of truth, queried client-side via wagmi. SSR would add complexity without clear benefit.
- Vite's fast HMR accelerates development.
- React's ecosystem dominance ensures long-term library availability and hiring pool.
- wagmi (ADR 0004) is a React-only library, so choosing React aligns the Web3 integration naturally.

## Consequences

- The web frontend is a React SPA built with Vite.
- Client-side routing (e.g., React Router or TanStack Router) is used.
- No server-side rendering; initial load is a client-side hydration of the app shell.
- The frontend communicates with the backend (ADR 0005) via REST/WebSocket APIs and with the blockchain via wagmi + viem (ADR 0004).
