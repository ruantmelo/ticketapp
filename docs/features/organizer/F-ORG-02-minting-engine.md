# F-ORG-02 — Minting Engine

| Field | Value |
|-------|-------|
| **ID** | F-ORG-02 |
| **Persona** | Organizer / Producer |
| **Milestone** | M1 (contract), M2 (full integration) |
| **Priority** | High |
| **Status** | In Progress |

## Summary

The system that takes an organizer's event configuration (from F-ORG-01) and deploys a smart contract on Polygon, then mints the corresponding NFT tickets. This is the bridge between the organizer's intent and the on-chain ticket supply.

## User Story

As an organizer, I want the platform to automatically create and deploy the ticket smart contract and mint all tickets when I publish an event, so that I do not need to interact with blockchain tooling or write any code.

## Acceptance Criteria

### Contract Side (M1)
- [ ] A Solidity contract can be deployed that represents ticket NFTs for an event.
- [ ] The contract supports minting a specified quantity of tickets per tier.
- [ ] The factory deploys the event contract with all ticket tier definitions.
- [ ] `TicketFactory.createEvent` deploys and registers the `TicketNFT`, but does not mint or finalize tickets.
- [ ] Only a platform orchestrator role can call `TicketFactory.createEvent`.
- [ ] Factory ownership/admin control can rotate the platform orchestrator role and emits an event when it changes.
- [ ] `TicketFactory` uses OpenZeppelin `Ownable`, with owner set to the platform admin/deployer.
- [ ] `TicketFactory` ownership is transferable for platform admin key rotation, but ownership renouncement is disabled.
- [ ] `TicketFactory` stores both an enumerable list of event contracts and an `eventReference -> TicketNFT address` mapping with uniqueness enforced.
- [ ] `TicketFactory.createEvent` emits an `EventContractCreated` event with event reference, ticket contract, organizer, tier count, and total configured supply.
- [ ] `TicketNFT` constructor validates organizer, marketplace, event reference, tier definitions, price cap multiplier, and royalty percentage before deployment succeeds.
- [ ] The backend mints tickets by calling `mintBatch` separately for each ticket tier.
- [ ] A ticket tier may be minted across multiple `mintBatch` calls, capped by configured supply.
- [ ] `mintBatch` enforces a contract-level maximum batch size, while the backend uses a network-specific operational batch size at or below that limit.
- [ ] All tickets are minted immediately when the event is published.
- [ ] The contract exposes an irreversible finalized minting state that prevents future minting after all configured tickets are minted.
- [ ] Only the organizer custodial wallet can finalize minting on-chain.
- [ ] Finalizing minting reverts unless every ticket tier's minted supply equals its configured supply.
- [ ] Primary sale transfers are blocked until minting is finalized.
- [ ] Transfers are restricted to minting, finalized primary sale distribution by the organizer, configured marketplace-operator flows, and authorized validator burns.
- [ ] Burns are allowed only after minting is finalized.
- [ ] Validator burns succeed without requiring ERC-721 token approval.
- [ ] `TicketNFT` includes minimal validator management needed to authorize burn permissions.
- [ ] Only the organizer custodial wallet can add or remove validators on-chain.
- [ ] Validator management is allowed before and after finalized minting, but burns are allowed only after finalized minting.
- [ ] Each minted token references an on-chain ticket tier through `tierId`.
- [ ] Token IDs are globally sequential within each `TicketNFT` contract.
- [ ] Each ticket tier stores tier reference, face value, and supply once per tier.
- [ ] `TicketNFT` implements ERC-721 `tokenURI(tokenId)` using a deployment-time base URI while rich metadata remains off-chain.
- [ ] The `tokenURI` base URI is immutable after deployment for MVP.
- [ ] The contract owner (organizer) is set at deployment.
- [ ] `TicketNFT` uses OpenZeppelin `Ownable`, with owner set to the organizer custodial wallet.
- [ ] `TicketNFT` ownership transfer and ownership renouncement are disabled for MVP.
- [ ] `TicketNFT` uses OpenZeppelin Contracts v5 and enforces transfer restrictions by overriding `_update`.
- [ ] `TicketNFT` implements ERC-2981 royalty support with immutable event-level royalty configuration.
- [ ] ERC-2981 royalty receiver is the organizer custodial wallet for MVP.
- [ ] Minted tickets are initially held by the organizer custodial wallet for primary sale distribution.
- [ ] Minting emits standard ERC-721 `Transfer(address(0), organizer, tokenId)` events per token and a custom batch summary event per `mintBatch` call.
- [ ] The contract emits events for mint, transfer, and burn operations (for off-chain indexing).
- [ ] Deployment and minting work on a local Hardhat network.
- [ ] Deployment and minting work on Polygon Amoy testnet.
- [ ] Polygon PoS mainnet deployment configuration is documented but not enabled for MVP execution.

### Full Integration (M2)
- [ ] Submitting an event configuration from F-ORG-01 triggers contract deployment automatically.
- [ ] The backend orchestrates: deploy contract → mint tier batches → store contract address → return to frontend.
- [ ] The organizer sees a success state with the deployed contract address and total minted count.
- [ ] Minting failures (e.g., insufficient gas, network error) leave the event in a not-published minting-incomplete state with a retry option.
- [ ] The event is not ready for primary sale until every configured ticket tier is fully minted and total minted count equals configured supply.
- [ ] The backend tracks minting workflow status separately from the contract's finalized minting state.
- [ ] The minted tickets are visible and ready for primary sale in the marketplace (F-BUY-02).

### M1 Implementation Boundary

- [ ] M1 includes the contract workspace, deployment scripts, and contract tests only.
- [ ] Backend integration remains M2 work after the contract ABI and deployment flow are stable.

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
- **ADR 0011** (MVP network) — **resolved (Accepted)**. MVP deployments target Polygon PoS, with Polygon Amoy for testnet deployments and Hardhat local network for local development.
- **ADR 0007** (Custodial wallet provider) — **unresolved (Proposed)**. The organizer address should be an organizer custodial wallet once the provider is selected. Until then, F-ORG-02 contracts accept any organizer address and local/testnet scripts may use a deployer/dev wallet as a stand-in.

## Resolved by ADR 0008 (Accepted)

- **Contract architecture**: Each event gets its own `TicketNFT` contract deployed by a `TicketFactory`. The factory is called by the minting engine backend. One shared `TicketMarketplace` handles all events.
- **NFT standard**: ERC-721 (OpenZeppelin base). Each ticket is a unique token ID.
- **Royalty**: ERC-2981 interface + enforced routing in the marketplace. Secondary sales only.

## Open Questions

- How are gas fees for minting paid — by the organizer, or subsidized by the platform? (Related to F-BUY-03 FIAT flow.)

## Implementation Scope Decisions

- F-ORG-02 implementation targets Hardhat local network and Polygon Amoy testnet now.
- Polygon PoS mainnet deployment configuration should be documented but not enabled yet, because production deployment introduces real funds, RPC/provider reliability, explorer verification, key custody, and operational controls that should be gated after contract correctness and end-to-end minting are verified.
- The contract owner / organizer address should be an organizer custodial wallet controlled through the platform backend. Until ADR 0007 is resolved, F-ORG-02 should accept an organizer address as an input and use a deployer/dev wallet as the temporary local/testnet stand-in.
- `TicketNFT` should use OpenZeppelin `Ownable`, with owner set to the organizer custodial wallet. The factory/platform orchestrator remains separate and does not own the event contract.
- For MVP, `TicketNFT` should prevent ownership transfer and ownership renouncement, preferably by overriding `transferOwnership` and `renounceOwnership` to revert. Organizer wallet rotation should be handled as a deliberate future feature/ADR.
- Use OpenZeppelin Contracts v5 and override `_update` for ERC-721 transfer restrictions, as specified by ADR 0008.
- Implement ERC-2981 in `TicketNFT` for F-ORG-02. Full royalty routing remains a F-BUY-02 marketplace responsibility, but `royaltyInfo(tokenId, salePrice)` should work independently.
- The ERC-2981 royalty receiver should be the organizer custodial wallet for MVP.
- Minted tickets should initially be held by the organizer custodial wallet. This keeps the lifecycle simple: organizer owns inventory → primary sale transfers ticket to buyer → secondary market handles resale.
- For M1/M2, all tickets should be minted immediately when the event is published. This matches the user story, gives clear on-chain supply, makes inventory predictable, and prepares tickets for primary sale. Polygon's lower gas cost makes pre-minting acceptable for the MVP.
- On-demand minting during primary sale is a possible post-MVP optimization if very large events make pre-minting operationally expensive.
- Store minimal immutable ticket metadata on-chain: tier ID, tier reference, face value, and event reference. Rich ticket metadata such as event name, description, artwork, venue, dates, images, and tier display names stays off-chain through the backend or a future URI-based metadata store.
- Implement `tokenURI(tokenId)` now as a base URI plus token-specific path, while keeping rich ticket metadata off-chain. The base URI can be set at deployment and point to backend metadata in local/testnet environments.
- The `tokenURI` base URI should be immutable after deployment for MVP. Metadata corrections can be served off-chain behind the same URI, but the on-chain pointer should not change unexpectedly.
- `tokenURI(tokenId)` should conceptually resolve to `baseURI/{eventReference}/{tokenId}`. For the MVP, store a deployment-time base URI that already includes the event path, such as `https://api.../events/{eventReference}/tickets/`, and have `tokenURI` append only `tokenId`.
- The on-chain event reference should be a `bytes32` value derived from the backend event ID. The backend remains responsible for mapping that value to the human-readable event record.
- Store ticket tier data once per tier and have each token reference its `tierId`. This avoids duplicating tier data across tickets, keeps face value consistent within a tier, and still allows `faceValue(tokenId)` to resolve through the token's tier.
- Use a `bytes32` tier reference on-chain instead of a full tier name string. Tier display names are UI metadata and should remain off-chain.
- The backend supplies `tierId` values from the event configuration, and the contract validates that no duplicate tier IDs are registered. This keeps F-ORG-01 as the owner of event configuration and avoids backend-to-contract tier mapping drift.
- The factory should deploy the event contract with all ticket tier definitions, then the backend should call `mintBatch` per tier in separate transactions. This keeps event configuration immutable while making minting easier to retry and observe.
- `TicketFactory.createEvent` should deploy only the `TicketNFT` and register it. The backend Minting Engine should orchestrate `createEvent -> mintBatch... -> finalizeMinting`, because minting batches need retry and progress handling.
- Only a platform-controlled deployer/orchestrator role should call `TicketFactory.createEvent`, protecting the platform event registry from spam or fake event contracts. The created `TicketNFT` owner remains the organizer custodial wallet.
- The factory should support rotating the platform orchestrator role through factory ownership/admin control, with an event emitted when the orchestrator changes. This supports operational key rotation without redeploying the factory or fragmenting the event registry.
- `TicketFactory` should use OpenZeppelin `Ownable`, with owner set to the platform admin/deployer. The factory owner can rotate the platform orchestrator role.
- `TicketFactory` ownership should remain transferable for platform admin key rotation, but `renounceOwnership` should be disabled so registry and orchestrator controls cannot be orphaned.
- Start with contract workspace, deployment scripts, and contract tests for M1. Backend integration belongs to M2 after the contract ABI and deployment flow are stable.
- `TicketFactory` should store both an enumerable list of deployed event contracts and an `eventReference -> TicketNFT address` mapping. It should reject duplicate event references so the same event cannot be deployed twice.
- `TicketFactory.createEvent` should emit `EventContractCreated(bytes32 indexed eventReference, address indexed ticketContract, address indexed organizer, uint256 tierCount, uint256 totalConfiguredSupply)`, so the backend indexer can recover event deployments and cross-check off-chain event configuration.
- `TicketNFT` constructor should validate: `organizer != address(0)`, `marketplace != address(0)`, `eventReference != bytes32(0)`, at least one ticket tier, each ticket tier has nonzero `tierId`, nonzero `tierReference`, nonzero `faceValue`, nonzero `configuredSupply`, no duplicate `tierId`, `100 <= maxResalePriceMultiplier <= 150`, and `royaltyPercentage` at or below the agreed maximum.
- For MVP, `maxResalePriceMultiplier` should be bounded from 100 to 150 inclusive. `100` means no-profit resale and `150` is the maximum allowed resale price cap multiplier.
- Royalty percentage should be represented in basis points and capped at 10% (`1000` basis points) to prevent abusive resale taxation while still allowing organizer upside.
- `faceValue` should be stored in the accepted payment token's smallest unit, so `maxResalePrice(tokenId)` can compare directly against marketplace sale prices without oracle or conversion ambiguity. Local and Polygon Amoy tests should use a mock ERC-20 with the same decimals as the intended Polygon stablecoin.
- Implement a minimal `MockUSDC` ERC-20 for local and Polygon Amoy contract tests only. It should be clearly marked as development/test-only and must not be treated as the production payment token.
- F-ORG-02 should implement only the marketplace address/interface/stub needed for transfer restriction tests. Full `TicketMarketplace` listing, buying, cancellation, payment, and royalty routing belong to F-BUY-02.
- If a `mintBatch` transaction fails after earlier tiers were minted, the Minting Engine should allow retry until completion. The backend should keep the event in a not-published minting-incomplete state until every ticket tier is fully minted and total minted count equals configured supply.
- Track minting completion in both the contract and backend with different meanings. The contract should have an irreversible `finalizeMinting()` / `mintingFinalized` flag that prevents future minting after the configured supply is minted. The backend should track workflow status, such as minting-incomplete and ready-for-primary-sale, for UX and retry handling.
- Only the organizer custodial wallet should be authorized to call `finalizeMinting()` on-chain. The backend may orchestrate the transaction, but the organizer custodial wallet should be the signer.
- Each ticket tier should track `configuredSupply` and `mintedSupply`. `finalizeMinting()` should verify on-chain that every ticket tier is fully minted and revert otherwise.
- `mintBatch` should allow partial fills across multiple calls for the same ticket tier, with the invariant `mintedSupply <= configuredSupply`. This supports large tiers and smaller retryable batches.
- `mintBatch` should be organizer-only on-chain. The backend may orchestrate minting, but the organizer custodial wallet should be the signer.
- Use both a contract-level hard limit for maximum `mintBatch` size and a backend-configured operational batch size. The contract limit prevents accidental absurd batches, while the backend can tune practical batch sizes for Hardhat local network and Polygon Amoy.
- Primary sale transfers should be blocked until `mintingFinalized == true`, so buyers cannot purchase tickets for an event whose configured supply is incomplete or unresolved.
- Implement the final transfer restriction shape in F-ORG-02: minting allows `address(0) -> organizer` only through minting; primary sale allows `organizer -> buyer` only when the operator is the organizer and `mintingFinalized == true`; secondary-market placeholder transfers are allowed only when the operator is the configured marketplace and `mintingFinalized == true`; authorized validators can burn after `mintingFinalized` without ERC-721 token approval; all other direct transfers revert.
- Do not allow transfers merely because `from` or `to` is the marketplace address. The marketplace path must be operator-based so users cannot send tickets directly into marketplace escrow without a listing.
- The organizer must not be able to move buyer-owned tickets. Primary sale authority is limited to transfers from the organizer custodial wallet's own inventory.
- Burns should be allowed only after `mintingFinalized`, because validation at the door is downstream of event publication and primary sale.
- Include minimal validator management in `TicketNFT` for F-ORG-02, enough to test access control and the authorized burn permission path. Scanner UX and operational burn signing remain F-VAL-01 concerns.
- Only the organizer custodial wallet should be authorized on-chain to add or remove validators. The backend may orchestrate the transaction, but the organizer custodial wallet should be the signer.
- Validator management should be allowed before and after `mintingFinalized`, so organizers can prepare door staff before publication and rotate access later. Burns remain blocked until `mintingFinalized`.
- Token IDs should be globally sequential within each `TicketNFT` contract, with `tokenId -> tierId` stored separately. Do not encode tier information into token IDs.
- Minting should emit both standard ERC-721 `Transfer(address(0), organizer, tokenId)` events per token and a custom `TicketsMintedBatch(bytes32 indexed eventReference, uint256 indexed tierId, uint256 fromTokenId, uint256 toTokenId, uint256 quantity, address indexed to)` summary event per batch. Including `eventReference` makes logs self-describing for indexer recovery and analytics.
