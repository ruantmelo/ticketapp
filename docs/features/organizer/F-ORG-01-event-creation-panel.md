# F-ORG-01 — Event Creation Panel

| Field | Value |
|-------|-------|
| **ID** | F-ORG-01 |
| **Persona** | Organizer / Producer |
| **Milestone** | M2 |
| **Priority** | High |
| **Status** | In Progress |

## Summary

A web interface that allows an organizer to create a new event by providing artwork, descriptions, dates, locations, and ticket tier configuration. This is the entry point for the organizer's workflow and feeds the Minting Engine (F-ORG-02).

## User Story

As an organizer, I want to create an event through a visual web panel with ticket tiers, prices, and resale rules, so that I can mint NFT tickets without needing any blockchain knowledge.

## Acceptance Criteria

- [ ] The organizer can upload event artwork (cover image) via the panel.
- [ ] The organizer can enter event title, description, date, and location.
- [ ] The organizer can define multiple ticket tiers (e.g., Pista, VIP, Camarote), each with:
  - [ ] Name
  - [ ] Quantity (number of tickets to mint)
  - [ ] Primary sale price
  - [ ] Resale price cap (maximum % above face value)
  - [ ] Royalty percentage (for secondary-market resales)
- [ ] The panel validates all inputs before submission (required fields, numeric ranges, image format/size).
- [ ] On submission, the configuration is sent to the backend to trigger the Minting Engine (F-ORG-02).
- [ ] The organizer sees a confirmation and preview of the created event with its on-chain parameters.
- [ ] The organizer can save a draft and return to complete it later.
- [ ] The organizer can view a list of their previously created events.

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **Off-chain (frontend)** | Form UI, input validation, artwork upload, draft persistence, event list display. |
| **Off-chain (backend)** | Receives the event configuration, stores metadata (artwork, description) in a database, and triggers the Minting Engine to deploy the contract and mint tickets. |
| **On-chain** | No direct on-chain logic in this feature. The on-chain result is produced by F-ORG-02 (Minting Engine). |

## Dependencies

- **F-ORG-02** (Minting Engine) — receives the configuration produced by this panel and executes the mint.
- **F-ORG-03** (Secondary Market Configuration) — the resale price cap and royalty fields entered here are enforced on-chain by the contract configured in F-ORG-03.
- **ADR 0008** (NFT standard) — must be resolved before the ticket-tier data model is finalized, as it affects whether tiers map to separate contracts or token IDs within one contract.

## Implementation Notes (M2)

- **Token standard:** The Pencil prototype's confirmation screen shows `Padrão de token: ERC-1155`, but ADR 0008 (Accepted) mandates **ERC-721**. The implementation follows the ADR and displays ERC-721.
- **Per-tier vs per-event cap/royalty:** F-ORG-01 collects cap/royalty **per tier** (matching the design's tier table). ADR 0008 sets a **single immutable** `maxResalePriceMultiplier` and `royaltyPercentage` per event contract. The panel stores per-tier values off-chain and displays **weighted averages** ("Cap de revenda médio", "Royalty média") in Revisão/Confirmation. Reconciliation to a single on-chain value is handled by F-ORG-02 (Minting Engine) when deploying the contract.
- **Minting Engine:** The backend's minting service is a **stub** during F-ORG-01 — it returns mock on-chain parameters (contract address, total supply, averages). Actual contract deployment is F-ORG-02's responsibility.

## Open Questions

- Where is event artwork stored — IPFS, a centralized CDN, or a hybrid? (Affects load time and decentralization posture.)
- Should the panel support multi-language events, or is Portuguese-only sufficient for the MVP?
- What is the maximum number of ticket tiers per event? (Affects contract design in F-ORG-02.)
- Should drafts auto-save, or require explicit save actions?
