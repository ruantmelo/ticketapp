# F-BUY-02 — Integrated Marketplace

| Field | Value |
|-------|-------|
| **ID** | F-BUY-02 |
| **Persona** | Buyer / Fan |
| **Milestone** | M3 |
| **Priority** | High |
| **Status** | In Progress |

## Summary

A unified marketplace where buyers can purchase primary-market tickets (directly from the organizer) and secondary-market tickets (from other users). Secondary listings are constrained by the on-chain price cap, and royalties are automatically routed to the organizer on every resale. The marketplace provides a guarantee of authenticity — every ticket is a verifiable on-chain NFT.

## User Story

As a buyer, I want to browse available tickets, buy primary or secondary tickets safely, and list my own tickets for resale when I cannot attend, so that I always get authentic tickets and can resell within fair rules.

## Acceptance Criteria

### Primary Market
- [ ] The marketplace lists active events with available primary tickets.
- [ ] The buyer can select a ticket tier and quantity and initiate a purchase.
- [ ] On purchase, the ticket NFT is transferred from the organizer/contract to the buyer's custodial wallet.
- [ ] The purchase price is handled via F-BUY-03 (FIAT Payments) or direct crypto payment (if implemented).

### Secondary Market
- [ ] A buyer who owns a ticket can list it for sale at a self-chosen price.
- [ ] The listing price cannot exceed the on-chain price cap; the UI rejects over-cap listings before submission.
- [ ] The on-chain transfer enforces the cap — even if the UI is bypassed, an over-cap sale reverts.
- [ ] On a secondary sale, the royalty percentage is automatically routed to the organizer's wallet.
- [ ] The buyer (new owner) receives the ticket NFT in their wallet.
- [ ] The seller receives the sale proceeds minus the royalty.

### General
- [ ] The marketplace displays the ticket's provenance: current owner, original face value, transfer history count.
- [ ] A buyer can view their own owned tickets and active listings in a "My Tickets" section.
- [ ] A seller can cancel an active listing and reclaim the ticket.
- [ ] Transactions show clear status: pending, confirmed, failed.
- [ ] The marketplace is accessible only to authenticated users (depends on F-BUY-01).

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain (smart contract)** | Enforces price cap on resale transfers, routes royalties to the organizer, transfers NFT ownership, emits events for primary sale, listing, sale, and cancellation. |
| **Off-chain (backend)** | Indexes on-chain listings and sales, serves marketplace data to the frontend, manages off-chain listing metadata (e.g., seller notes), coordinates the FIAT-to-crypto conversion (with F-BUY-03). |
| **Off-chain (frontend)** | Renders event/ticket listings, purchase flow, listing creation flow, "My Tickets" view, transaction status feedback. Uses wagmi + viem for blockchain reads/writes. |

## Dependencies

- **F-BUY-01** (Web2.5 Onboarding) — users must have a custodial wallet to buy, list, or receive tickets.
- **F-ORG-02** (Minting Engine) — the tickets being sold are minted by this feature.
- **F-ORG-03** (Secondary Market Configuration) — the price cap and royalty parameters that the marketplace enforces.
- **F-BUY-03** (FIAT Payments) — handles the payment side of purchases (primary and secondary).
- **ADR 0008** (NFT standard) — the marketplace's on-chain interaction (listing, sale, transfer) depends on the contract architecture chosen in this ADR.

## Resolved by ADR 0008 (Accepted)

- **Marketplace model**: On-chain escrow. The `TicketMarketplace` contract holds the NFT during listing and executes the sale (payment + royalty routing + transfer) atomically. The backend cannot manipulate or frontrun sales.
- **Payment currency**: A single ERC-20 stablecoin (specific token TBD in F-BUY-03). The buyer's custodial wallet pays the marketplace in the stablecoin; the FIAT-to-crypto backend handles conversion.
- **Direct transfers**: Blocked. All secondary sales must go through the marketplace — there is no direct P2P transfer path. The NFT contract only allows transfers from the organizer, the marketplace, and authorized validators.

## Implementation Notes

- **Real `TicketMarketplace` contract** (`packages/contracts/contracts/TicketMarketplace.sol`): on-chain escrow `list`/`buy`/`cancelListing`, reusing `TicketNFT`'s existing `maxResalePrice(tokenId)` view for the cap check and its inherited ERC-2981 `royaltyInfo` for royalty routing — no changes needed to `TicketNFT.sol`. Payment is a single ERC-20 (`MockUSDC.sol`). Prices/face values are passed on-chain as plain integers with no currency-decimal conversion — the same convention already established by the minting engine for `faceValue` (see `minting.service.ts`'s "smallest payment-token units" comment); this is a dev-only simplification, not a real fiat/stablecoin exchange rate. Covered by `packages/contracts/test/marketplace.test.ts` (cap rejection, escrow, royalty routing, cancellation, double-listing).
- **Backend** (`apps/api/src/marketplace/routes.ts` + `services/marketplace.service.ts`): full CRUD for browsing, primary/secondary purchase, listing, and cancellation, backed by new `ticketTokens.ownerUserId`/`status` columns and a new `listings` table (`apps/api/src/db/schema.ts`). Mirrors the existing minting engine's mock/real branch (`env.onchainMintingEnabled`) — with Anvil off (default), operations only update the database; with it on, the same code paths execute real on-chain transactions.
- **Buyer wallet (dev stopgap):** since ADR 0007 is unresolved, a single shared "custodial" signer (`BUYER_CUSTODIAL_PRIVATE_KEY`) represents every buyer's on-chain wallet — omnibus custody. The app's database (`ownerUserId` per ticket token) tracks which real user owns which ticket; on-chain, one address holds all buyer-owned tokens. A secondary sale is technically buyer-custodial-to-itself on-chain (only the organizer's royalty cut goes to a distinct address) but still exercises the real cap/royalty/escrow logic end-to-end. See [F-BUY-01](F-BUY-01-web2-onboarding.md).
- **Self-listing guard:** buying your own resale listing is blocked server-side (`POST /marketplace/listings/:id/buy` rejects when `sellerId === buyer`); the UI hides the "Comprar" button and shows a "Seu anúncio" badge for the current user's own listings.
- **Frontend** (`apps/web/src/lib/api.ts`, `lib/queries.ts`, `routes/_authed/{marketplace,checkout,tickets}/*`): wired to the real endpoints above.
- Not implemented: offer/bidding, listing fees, provenance/transfer-history display, and (per F-BUY-03) real FIAT payment — checkout still simulates Pix/Cartão in the UI only.

## Open Questions

- Should the marketplace support offers/bidding (buyers propose a price below the listing), or only fixed-price listings for the MVP?
- How are listing fees (if any) handled — does the platform take a fee on top of the royalty?
- Should tickets be listed in FIAT currency (display) while the on-chain transaction is in stablecoin? (Likely yes, given the Web2.5 approach.)
