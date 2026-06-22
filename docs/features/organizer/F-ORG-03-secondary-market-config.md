# F-ORG-03 — Secondary Market Configuration

| Field | Value |
|-------|-------|
| **ID** | F-ORG-03 |
| **Persona** | Organizer / Producer |
| **Milestone** | M1 (contract), M2 (full integration) |
| **Priority** | High |
| **Status** | Not Started |

## Summary

Allows the organizer to define and enforce rules for the secondary market at the contract level: a maximum resale price (price cap) to combat scalping, and a programmable royalty percentage that returns to the organizer on every resale. These rules are set at event creation and enforced cryptographically by the smart contract.

## User Story

As an organizer, I want to set a maximum resale price and a royalty percentage for my event's tickets, so that scalpers cannot inflate prices and I earn revenue from every secondary-market transaction — with enforcement that cannot be bypassed off-platform.

## Acceptance Criteria

### Contract Side (M1)
- [ ] The contract accepts a `maxResalePriceMultiplier` (e.g., 120 = 20% above face value) at deployment.
- [ ] The contract accepts a `royaltyPercentage` (e.g., 500 = 5%) at deployment, compatible with ERC-2981 interface.
- [ ] Any transfer (resale) that exceeds the price cap reverts the transaction.
- [ ] On a valid resale, the royalty amount is automatically routed to the organizer's wallet.
- [ ] The price cap and royalty are immutable after deployment (or updatable only by the organizer, depending on design decision — see Open Questions).
- [ ] Direct NFT transfers without going through the marketplace are also subject to the price cap (or blocked entirely — see Open Questions).
- [ ] Unit tests verify: cap enforcement, royalty disbursement, rejection of over-cap transfers.

### Full Integration (M2)
- [ ] The organizer can configure price cap and royalty in the Event Creation Panel (F-ORG-01).
- [ ] The configured values are passed to the contract at deployment (via F-ORG-02).
- [ ] The organizer can view the enforced rules in the event preview.
- [ ] The marketplace (F-BUY-02) reads these parameters and prevents listings above the cap.

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain (smart contract)** | Enforces price cap on transfer, calculates and routes royalty to organizer, exposes parameters via view functions for the marketplace to query. |
| **Off-chain (backend/frontend)** | Provides the UI for configuration (F-ORG-01), passes parameters to deployment (F-ORG-02), and queries on-chain parameters to enforce UI-level listing limits (F-BUY-02). |

## Dependencies

- **F-ORG-01** (Event Creation Panel) — provides the input fields for cap and royalty.
- **F-ORG-02** (Minting Engine) — embeds the cap and royalty into the deployed contract.
- **F-BUY-02** (Integrated Marketplace) — reads the on-chain parameters to constrain listings and execute compliant resales.
- **ADR 0008** (NFT standard) — **blocking dependency**. The transfer restriction pattern (e.g., override `_transfer`, hook-based, or a marketplace-only transfer model) depends on the chosen NFT standard and architecture.

## Resolved by ADR 0008 (Accepted)

- **Direct P2P transfers**: Blocked entirely. The NFT contract overrides `_update` to only allow transfers from the organizer, the marketplace contract, and authorized validators (for burns). No direct user-to-user transfers are possible.
- **Price cap / royalty mutability**: Immutable after deployment. Set in the constructor, never changeable.
- **Sale price enforcement**: On-chain escrow via the dedicated `TicketMarketplace` contract. The marketplace holds the NFT during listing, accepts ERC-20 payment from the buyer, checks the cap, routes the royalty to the organizer, pays the seller, and transfers the NFT atomically.
- **Royalties on**: Secondary sales only. Primary sales are organizer → buyer at face value (no royalty needed).

## Open Questions

- How are gas fees for the organizer's primary-sale distribution transactions paid — by the organizer, or subsidized by the platform? (Related to F-BUY-03 FIAT flow.)
- Should the marketplace support partial-fill (multiple buyers splitting a listing) or is each listing a single-ticket sale? (Single-ticket per listing is the MVP default per ADR 0008.)
