# ADR 0002: Ethereum + Hardhat for Smart Contracts

| Field | Value |
|-------|-------|
| **Status** | Superseded by [ADR 0011](0011-polygon-for-mvp-network.md) for target blockchain only |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

The platform's core value proposition — fraud-proof tickets, programmable royalties, and price-cap enforcement — requires smart contracts. We need to choose a blockchain platform and a development framework. The choice determines the contract language, tooling, security audit ecosystem, and gas cost profile.

## Considered Options

### Option 1: Ethereum L1 + Solidity + Hardhat
- **Pros**: Largest smart contract ecosystem; most audit tools and security researchers; Solidity is the most widely known contract language; Hardhat is a mature dev framework with local network, testing, and deployment; EVM compatibility allows future migration to L2s (Polygon, Arbitrum, Optimism) with minimal contract changes.
- **Cons**: Ethereum L1 gas fees are high, which could be prohibitive for high-frequency secondary-market transactions at scale.

### Option 2: Polygon + Solidity + Hardhat
- **Pros**: EVM-compatible (same Solidity contracts); drastically lower gas fees; suitable for ticketing with frequent resales.
- **Cons**: Less decentralized than Ethereum L1; some audit tooling is Ethereum-centric; adds a bridge/relay dependency.

### Option 3: Solana + Rust + Anchor
- **Pros**: Extremely low fees and high throughput; well-suited for high-volume ticketing.
- **Cons**: Non-EVM; requires Rust expertise; smaller audit ecosystem; different tooling; would not share types or tooling with the EVM-based web3 client.

## Decision

We chose **Ethereum L1 + Solidity + Hardhat** for the MVP. The target blockchain portion of this decision was later superseded by [ADR 0011](0011-polygon-for-mvp-network.md), which chooses Polygon PoS for the MVP. Solidity and Hardhat remain accepted.

Development and testing use the **Hardhat local dev network**. The contracts are EVM-compatible, so migration to an L2 (e.g., Polygon) is a deployment decision, not a rewrite, if gas costs become prohibitive at scale.

## Rationale

- Security and auditability are paramount for a ticketing platform handling real money and entry access.
- The EVM ecosystem has the deepest security tooling (Slither, MythX, Echidna) and the largest pool of auditors.
- Hardhat provides everything needed for local development, testing, and deployment scripting.
- Starting on L1 with an EVM-compatible architecture keeps the L2 migration option open without locking us in.

## Consequences

- Smart contracts are written in Solidity.
- Development uses Hardhat's local network for testing.
- Gas costs on Ethereum L1 may be high for secondary-market transactions at scale; an L2 migration ADR may be needed post-MVP.
- The web3 client (wagmi + viem, per ADR 0004) is EVM-native, which aligns with this choice.
