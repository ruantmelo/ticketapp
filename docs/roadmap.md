# Roadmap

The project is delivered in five milestones. Each milestone produces a testable increment and resolves one or more open architecture decisions (ADRs).

## Milestone Overview

| Milestone | Name | Features | ADRs Resolved | Status |
|-----------|------|----------|---------------|--------|
| M1 | Contract MVP | F-ORG-02 (contract), F-ORG-03 (contract) | 0008 (NFT standard) — Resolved | Not Started |
| M2 | Organizer Panel | F-ORG-01, F-ORG-02 (full), F-ORG-03 (full) | — | Not Started |
| M3 | Buyer Onboarding + Marketplace | F-BUY-01, F-BUY-02 | 0007 (Custodial wallet) | Not Started |
| M4 | Dynamic Ticket + Scanner | F-BUY-04, F-VAL-01, F-VAL-02 | 0009 (QR scheme), 0010 (Offline validation) | Not Started |
| M5 | FIAT Payments + Analytics | F-BUY-03, F-ORG-04 | — | Not Started |

---

## M1: Contract MVP

**Goal:** Deliver the core smart contract that represents a ticket NFT with all enforcement logic.

**Scope:**
- NFT contract supporting mint, transfer, and burn operations.
- Transfer restrictions enforcing a maximum resale price (price cap).
- Royalty mechanism routing a percentage of resale value to the organizer.
- Burn-on-validation: a ticket can be invalidated by an authorized validator.
- Unit tests covering all contract behavior using Hardhat.

**Features:**
- F-ORG-02 (Minting Engine) — contract side only (mint logic)
- F-ORG-03 (Secondary Market Configuration) — contract side only (price cap + royalty logic)

**ADRs resolved:**
- 0008 — NFT standard (ERC-721), royalty standard (ERC-2981 + enforced routing), transfer restriction pattern (dedicated marketplace contract with on-chain escrow, direct P2P transfers blocked). **Status: Accepted.**

**Exit criteria:**
- Contract compiles and deploys to a local Hardhat network.
- All unit tests pass.
- Price cap enforcement is verified: a transfer above the cap reverts.
- Royalty disbursement is verified on a simulated resale.
- Burn operation is verified and prevents subsequent transfers.

---

## M2: Organizer Panel

**Goal:** Give organizers a web interface to create events and mint tickets without touching blockchain tooling directly.

**Scope:**
- Event creation form (art upload, title, description, date, location, ticket tiers).
- Configuration of ticket quantity, primary price, resale price cap, and royalty percentage.
- Minting flow: form submission triggers contract deployment and NFT minting via the backend.
- Preview of the deployed event and its ticket parameters.

**Features:**
- F-ORG-01 (Event Creation Panel) — full
- F-ORG-02 (Minting Engine) — full (frontend + backend + contract integration)
- F-ORG-03 (Secondary Market Configuration) — full (config UI wired to contract)

**Exit criteria:**
- An organizer can create an event, set parameters, and mint a batch of tickets through the UI.
- The minted tickets appear on-chain with the correct parameters.
- No CLI or blockchain knowledge is required from the organizer.

---

## M3: Buyer Onboarding + Marketplace

**Goal:** Let end users register without blockchain knowledge and buy/list tickets in a secure marketplace.

**Scope:**
- Registration/login via email and password (no seed phrases).
- Custodial wallet provisioning: a wallet is created for each user invisibly.
- Primary market: buy tickets directly from the organizer's event.
- Secondary market: list an owned ticket for sale (within price cap) and buy listed tickets from others.
- On-chain transfers enforced by the contract (price cap, royalty disbursement).

**Features:**
- F-BUY-01 (Web2.5 Onboarding) — full
- F-BUY-02 (Integrated Marketplace) — full

**ADRs resolved:**
- 0007 — Custodial wallet provider (Web3Auth / Magic.link / Particle / custom)

**Exit criteria:**
- A new user can register with email and automatically receive a custodial wallet.
- The user can purchase a primary-market ticket and see it in their account.
- The user can list a ticket for resale at or below the price cap; listings above the cap are rejected.
- A buyer can purchase a secondary-market listing; the royalty is routed to the organizer and the ticket transfers ownership.

---

## M4: Dynamic Ticket + Scanner

**Goal:** Deliver the anti-fraud entry experience — dynamic QR tickets and a fast scanner app with offline resilience.

**Scope:**
- Dynamic QR generation in the buyer app: a time-rotating, wallet-signed QR payload.
- Scanner app (React Native / Expo): reads the QR, verifies the signature, checks on-chain ownership and burn status.
- Clear pass/fail UI with visual and haptic feedback.
- Offline mode: cache valid ownership/burn data so validation continues during internet outages.

**Features:**
- F-BUY-04 (Dynamic Ticket QR) — full
- F-VAL-01 (Scanner App) — full
- F-VAL-02 (Offline Mode / Cache) — full

**ADRs resolved:**
- 0009 — Dynamic QR signing scheme and rotation interval
- 0010 — Offline validation mechanism (cached proofs vs Merkle snapshots)

**Exit criteria:**
- The buyer app displays a QR that changes at the configured interval and is bound to the holder's wallet.
- A screenshot of a previous QR is rejected by the scanner.
- The scanner validates a live QR in under 1 second with clear pass/fail feedback.
- The scanner continues to validate tickets for a configurable period after losing internet connectivity.
- A burned (used) ticket is rejected on scan.

---

## M5: FIAT Payments + Analytics

**Goal:** Remove the last friction for mainstream adoption (FIAT payment) and give organizers actionable data.

**Scope:**
- Pix integration for Brazilian buyers.
- Credit card integration for international/alternative payment.
- Backend FIAT-to-crypto conversion: accept FIAT, execute the blockchain transaction on the user's behalf.
- Analytics dashboard: real-time primary sales, secondary market volume, and demographic data.

**Features:**
- F-BUY-03 (FIAT Payments) — full
- F-ORG-04 (Analytics Dashboard) — full

**Exit criteria:**
- A buyer can complete a purchase using Pix without ever holding or seeing cryptocurrency.
- A buyer can complete a purchase using a credit card.
- The analytics dashboard displays live primary sale counts, secondary market volume, and basic demographics.
- The organizer can filter analytics by event and time range.

---

## Dependency Graph

```
M1 (Contract MVP)
 └─> M2 (Organizer Panel)
      └─> M3 (Buyer Onboarding + Marketplace)
           ├─> M4 (Dynamic Ticket + Scanner)
           └─> M5 (FIAT Payments + Analytics)
```

M4 and M5 can proceed in parallel after M3, but M4 depends on the dynamic QR (F-BUY-04) which is buyer-facing, so M3's custodial wallet must be in place first.
