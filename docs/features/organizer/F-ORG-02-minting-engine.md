# F-ORG-02 — Minting Engine

| Field | Value |
|-------|-------|
| **ID** | F-ORG-02 |
| **Persona** | Organizer / Producer |
| **Milestone** | M1 (contract), M2 (full integration) |
| **Priority** | High |
| **Status** | Not Started |

## Summary

The system that takes an organizer's event configuration (from F-ORG-01) and deploys a smart contract on the Ethereum blockchain, then mints the corresponding NFT tickets. This is the bridge between the organizer's intent and the on-chain ticket supply.

## User Story

As an organizer, I want the platform to automatically create and deploy the ticket smart contract and mint all tickets when I publish an event, so that I do not need to interact with blockchain tooling or write any code.

## Acceptance Criteria

### Contract Side (M1)
- [ ] A Solidity contract can be deployed that represents ticket NFTs for an event.
- [ ] The contract supports minting a specified quantity of tickets per tier.
- [ ] Each minted token stores metadata: tier name, face value, event reference.
- [ ] The contract owner (organizer) is set at deployment.
- [ ] Minted tickets are initially held by the contract (or organizer wallet) for primary sale distribution.
- [ ] The contract emits events for mint, transfer, and burn operations (for off-chain indexing).
- [ ] Deployment and minting work on a local Hardhat network.

### Full Integration (M2)
- [ ] Submitting an event configuration from F-ORG-01 triggers contract deployment automatically.
- [ ] The backend orchestrates: deploy contract → mint tier batches → store contract address → return to frontend.
- [ ] The organizer sees a success state with the deployed contract address and total minted count.
- [ ] Minting failures (e.g., insufficient gas, network error) are surfaced to the organizer with a retry option.
- [ ] The minted tickets are visible and ready for primary sale in the marketplace (F-BUY-02).

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain (smart contract)** | NFT minting logic, token metadata storage, ownership assignment, event emission. Enforces that only the authorized organizer can mint. |
| **Off-chain (backend)** | Receives the event config, constructs the deployment transaction, submits it via a signer, waits for confirmation, stores the contract address and event metadata, and indexes mint events. |
| **Off-chain (frontend)** | Displays minting progress and final status to the organizer (part of F-ORG-01). |

## Dependencies

- **F-ORG-01** (Event Creation Panel) — provides the configuration that drives minting.
- **F-ORG-03** (Secondary Market Configuration) — the contract must incorporate price cap and royalty parameters at deployment time.
- **ADR 0008** (NFT standard) — **resolved (Accepted)**. The contract architecture is: ERC-721 (OpenZeppelin-based), per-event `TicketNFT` contract deployed via a `TicketFactory`, with a shared `TicketMarketplace` for secondary sales. Price cap and royalty are immutable after deployment.

## Resolved by ADR 0008 (Accepted)

- **Contract architecture**: Each event gets its own `TicketNFT` contract deployed by a `TicketFactory`. The factory is called by the minting engine backend. One shared `TicketMarketplace` handles all events.
- **NFT standard**: ERC-721 (OpenZeppelin base). Each ticket is a unique token ID.
- **Royalty**: ERC-2981 interface + enforced routing in the marketplace. Secondary sales only.

## Open Questions

- Should ticket metadata be stored on-chain or off-chain (via token URI pointing to IPFS/backend)? On-chain is more verifiable but costlier.
- How are gas fees for minting paid — by the organizer, or subsidized by the platform? (Related to F-BUY-03 FIAT flow.)
- Should minting be atomic (all-or-nothing) or allow partial mint if a tier fails?
