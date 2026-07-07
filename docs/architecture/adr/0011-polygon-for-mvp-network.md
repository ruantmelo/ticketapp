# ADR 0011: Polygon for MVP Network

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-30 |
| **Deciders** | Project team |
| **Supersedes** | [0002](0002-ethereum-hardhat-for-contracts.md) for target blockchain only |

## Context

ADR 0002 chose Ethereum L1 for the MVP because security and auditability were prioritized over gas cost. For a ticketing platform, however, minting, primary sale distribution, secondary-market escrow, and burn-on-validation can all require frequent transactions. Ethereum L1 gas costs would make real event usage impractical.

## Decision

Use **Polygon PoS** as the MVP target network, with **Polygon Amoy** as the testnet target and **Polygon PoS mainnet** as the production target.

The project keeps **Solidity + Hardhat** and the EVM-compatible contract architecture from ADR 0002 and ADR 0008.

## Consequences

- The MVP optimizes for low transaction cost while preserving EVM compatibility.
- Hardhat local network remains the local development target.
- Deployment scripts, RPC configuration, block explorer links, and chain IDs must target Polygon environments.
- Payment-token selection in F-BUY-03 must use a Polygon-compatible stablecoin.
- Ethereum L1 remains a possible future deployment target, but it is no longer the MVP target network.
