# ADR 0008: NFT Standard, Royalties, and Transfer Restrictions

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |
| **Blocks** | M1 (F-ORG-02, F-ORG-03, F-BUY-02) |
| **Supersedes** | None |

## Context

The core smart contract represents tickets as NFTs and must enforce three rules: (1) a maximum resale price (price cap) to prevent scalping, (2) a programmable royalty routed to the organizer on every resale, and (3) a burn mechanism to invalidate used tickets. The choice of NFT standard, royalty standard, and transfer restriction pattern determines the entire contract architecture and affects the marketplace design (F-BUY-02), the minting engine (F-ORG-02), and the secondary market configuration (F-ORG-03).

This is the most critical architecture decision for the on-chain layer.

## Decision

### 1. NFT Standard: ERC-721

Each ticket is a unique ERC-721 token (one ticket = one token ID).

**Rationale:**
- Each ticket requires individual ownership tracking via `ownerOf(tokenId)` — the dynamic QR (F-BUY-04) and scanner (F-VAL-01) verify a specific token's owner.
- Each ticket requires individual burn tracking — a burned ticket must be rejected at the door.
- Each ticket may carry unique metadata (seat number, tier) that distinguishes it from others in the same tier.
- ERC-1155's semi-fungible model (where tickets within a tier share a token ID with a balance) breaks per-ticket verification: `balanceOf(owner, tokenId)` tells you how many tickets of a tier someone holds, not which specific ticket.
- Gas savings from ERC-1155 batch minting do not justify this complexity for the MVP on the Hardhat dev network.

**Implementation:** Use OpenZeppelin's `ERC721` as the base implementation (audited, industry-standard).

### 2. Royalty: ERC-2981 + Enforced Routing in Marketplace

Implement the ERC-2981 royalty info interface for interoperability, and enforce actual royalty payment in the marketplace contract.

**Rationale:**
- ERC-2981 alone is informational — marketplaces *can* query `royaltyInfo(tokenId, salePrice)` but are not required to pay. A marketplace could ignore it.
- Since all secondary sales are forced through our marketplace contract (see Decision 3), the marketplace enforces the royalty by routing the percentage to the organizer on every sale.
- Implementing ERC-2981 alongside this ensures third-party tools and explorers can read the royalty rate.

**Royalties apply to secondary sales only.** Primary sales are organizer → buyer at face value; the organizer is the seller and needs no royalty on their own sale.

### 3. Transfer Restriction: Dedicated Marketplace Contract (On-Chain Escrow)

**All secondary-market sales go through a dedicated `TicketMarketplace` contract.** The NFT contract overrides `_update` (OpenZeppelin's internal transfer hook) to restrict transfers to:

| Allowed transferer | Purpose |
|--------------------|---------|
| The organizer (contract owner) | Primary sale distribution (mint → buyer) |
| The `TicketMarketplace` contract | Secondary-market sales (escrow + sale) |
| Authorized validator addresses | Burn on validation |

**All other direct transfers revert.** A user cannot call `transferFrom` or `safeTransferFrom` to send a ticket to another user directly. This is the core anti-cambismo mechanism — it is impossible to bypass the price cap or royalty because no transfer path exists outside the marketplace.

**On-chain escrow model:** When a seller lists a ticket, the NFT is transferred from the seller to the marketplace contract (escrow). When a buyer purchases, the marketplace:
1. Checks `price <= ticketContract.maxResalePrice(tokenId)` (cap enforcement).
2. Checks the ticket is not burned.
3. Accepts payment from the buyer (ERC-20 token).
4. Routes `royaltyAmount` to the organizer's wallet.
5. Routes `price - royaltyAmount` to the seller's wallet.
6. Transfers the NFT from escrow to the buyer.
7. Emits a `Sale` event.

All steps execute atomically in a single transaction — the sale either completes fully or reverts.

**Rationale:**
- On-chain escrow is trustless: the backend cannot frontrun, manipulate prices, or abscond with funds or tickets.
- The price cap is enforced at the point of sale because the marketplace knows the sale price (the buyer sends payment to the marketplace).
- Overriding `_update` on the NFT contract is the cleanest way to restrict transfers while remaining compatible with the ERC-721 standard's external interface.

### 4. Price Cap and Royalty: Immutable After Deployment

The `maxResalePriceMultiplier` and `royaltyPercentage` are set in the `TicketNFT` constructor and cannot be changed after deployment.

**Rationale:**
- Immutability is more trustless — the organizer cannot raise the cap mid-event to enable scalping.
- It matches the "cryptographic guarantee" promise to buyers: the rules they see at purchase time are the rules that hold forever.
- Simpler to audit — no state-changing functions for cap/royalty, no access control concerns for updates.
- If an organizer needs different rules, they create a new event.

### 5. Contract Architecture: Per-Event NFT + Shared Marketplace + Factory

Three contracts form the on-chain system:

```
TicketFactory (deployed once)
  └─ creates ─> TicketNFT (one per event)
                  └─ transfers restricted to ─> TicketMarketplace (deployed once, shared)
```

| Contract | Deployment | Count |
|----------|------------|-------|
| `TicketFactory` | Once, at platform setup | 1 |
| `TicketMarketplace` | Once, at platform setup | 1 |
| `TicketNFT` | Per event, via the factory | 1 per event |

**Rationale:**
- Per-event `TicketNFT`: each event has its own parameters (cap, royalty, organizer, tiers). A dedicated contract per event keeps state isolated and allows independent verification.
- Shared `TicketMarketplace`: one marketplace handles all events. Less code to audit, consistent behavior, lower deployment cost. The marketplace reads cap and royalty from each `TicketNFT` via standard view functions.
- `TicketFactory`: the minting engine (F-ORG-02) calls the factory to deploy a new `TicketNFT` with the organizer's parameters. The factory stores a registry of all event contracts.

### 6. Payment Currency: ERC-20 (Stablecoin)

The marketplace accepts payment in a single ERC-20 token (a stablecoin such as USDC, to be finalized in F-BUY-03). The specific token address is set at marketplace deployment.

**Rationale:**
- Stablecoin pricing avoids volatility between listing and purchase.
- The FIAT-to-crypto backend (F-BUY-03) converts Pix/card payments to the stablecoin and the buyer's custodial wallet pays the marketplace.
- A single accepted token simplifies the marketplace logic (no price oracle needed for the payment side).

**Note:** The exact stablecoin choice is deferred to F-BUY-03's open questions. The marketplace architecture supports any ERC-20.

## Contract Interface Summary (Preliminary)

### TicketNFT (ERC-721 + ERC-2981)

```solidity
constructor(
    string name,
    string symbol,
    address organizer,
    uint256 maxResalePriceMultiplier,  // e.g., 120 = 20% above face value
    uint256 royaltyPercentage,          // e.g., 500 = 5%
    address marketplaceAddress
)

// Minting (only organizer)
function mint(address to, uint256 tierId) external
function mintBatch(address to, uint256 tierId, uint256 quantity) external

// Burning (only authorized validators)
function burn(uint256 tokenId) external
function isBurned(uint256 tokenId) external view returns (bool)

// View functions
function faceValue(uint256 tokenId) external view returns (uint256)
function maxResalePrice(uint256 tokenId) external view returns (uint256)
function organizer() external view returns (address)

// ERC-2981
function royaltyInfo(uint256 tokenId, uint256 salePrice)
    external view returns (address receiver, uint256 royaltyAmount)

// Validator management (only organizer)
function addValidator(address validator) external
function removeValidator(address validator) external

// Internal: override _update to restrict transfers
// Allowed callers: organizer, marketplace, authorized validators (for burn)
```

### TicketMarketplace

```solidity
constructor(address paymentToken)  // ERC-20 stablecoin address

// Listing (seller transfers NFT to marketplace escrow)
function list(address ticketContract, uint256 tokenId, uint256 price) external returns (uint256 listingId)

// Purchase (buyer pays ERC-20, marketplace routes funds + NFT)
function buy(uint256 listingId) external

// Cancel (seller reclaims NFT from escrow)
function cancelListing(uint256 listingId) external

// Views
function getListing(uint256 listingId) external view returns (...)
function isListed(address ticketContract, uint256 tokenId) external view returns (bool)

// Events
event ListingCreated(uint256 listingId, address ticketContract, uint256 tokenId, address seller, uint256 price)
event Sale(uint256 listingId, address ticketContract, uint256 tokenId, address buyer, address seller, uint256 price, uint256 royaltyAmount)
event ListingCancelled(uint256 listingId)
```

### TicketFactory

```solidity
constructor(address marketplaceAddress)

function createEvent(
    string name,
    string symbol,
    uint256 maxResalePriceMultiplier,
    uint256 royaltyPercentage
) external returns (address ticketNFTAddress)

function getEvents() external view returns (address[])
```

## Consequences

- **Smart contracts are written in Solidity using OpenZeppelin's ERC-721 base.**
- **Three contracts**: `TicketFactory`, `TicketMarketplace` (shared), `TicketNFT` (per-event).
- **All secondary sales must go through the marketplace contract** — no direct P2P transfers. This is the anti-cambismo enforcement point.
- **Price cap and royalty are immutable** after event contract deployment.
- **Royalties apply to secondary sales only.**
- **The marketplace uses on-chain escrow** — the NFT is held by the marketplace during listing, and the sale (payment + royalty + transfer) is atomic.
- **Payment is in a single ERC-20 stablecoin** (specific token TBD in F-BUY-03).
- **The minting engine (F-ORG-02) calls the factory** to deploy event contracts.
- **The marketplace (F-BUY-02) calls `list` / `buy` / `cancelListing`** for secondary-market operations.
- **The scanner app (F-VAL-01) calls `burn`** via an authorized validator address — the "who signs the burn" question remains an F-VAL-01 open question.
- **Gas cost**: on-chain escrow adds gas per secondary sale (escrow transfer + sale execution). This is acceptable for the MVP on Hardhat; L2 migration (post-MVP) can reduce costs if needed.
- **Upgradeability**: contracts are not upgradeable in the MVP (no proxy pattern). If contract bugs are found, a new event contract can be deployed. Upgradeability via UUPS/transparent proxies is a post-MVP consideration.

## Open Items Deferred to Other ADRs / Features

| Item | Deferred to |
|------|-------------|
| Specific ERC-20 stablecoin for payment | F-BUY-03 open questions |
| Who signs the burn transaction (validator wallet vs. backend relayer) | F-VAL-01 open questions |
| Gas fee payment strategy (subsidized vs. baked into price vs. gasless relayer) | ADR 0007 (custodial wallet) + F-BUY-03 |
| L2 migration for lower gas | Future ADR (post-MVP) |
| Proxy/upgradeability pattern | Future ADR (post-MVP) |
