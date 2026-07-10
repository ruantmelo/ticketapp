# F-BUY-04 — Dynamic Ticket QR (Anti-Print)

| Field | Value |
|-------|-------|
| **ID** | F-BUY-04 |
| **Persona** | Buyer / Fan |
| **Milestone** | M4 |
| **Priority** | High |
| **Status** | In Progress |

## Summary

The buyer's ticket in the app displays a QR code that rotates at a fixed time interval and is cryptographically signed by the current holder's wallet. This prevents screenshot-based fraud — a printed or screenshotted QR becomes stale within seconds and is rejected by the scanner. The QR is validated against both the signature and the on-chain ownership state.

## User Story

As a buyer, I want my ticket to show a live, rotating QR code at the event door, so that no one can screenshot my ticket and use it to enter before me.

As an organizer, I want the ticket QR to be dynamic and wallet-bound, so that screenshots and printed copies are useless and fraud is eliminated.

## Acceptance Criteria

- [ ] The buyer app displays a QR code for each owned, unburned ticket.
- [ ] The QR payload changes at a configurable interval (e.g., every 10 seconds — exact interval per ADR 0009).
- [ ] Each QR payload includes:
  - [ ] The ticket NFT contract address and token ID.
  - [ ] A timestamp (or time-window index) indicating the current validity window.
  - [ ] A cryptographic signature produced by the holder's wallet over the above data + timestamp.
- [ ] The QR is rendered client-side in the buyer app using the custodial wallet's signing capability.
- [ ] A screenshot of a previous QR (expired window) is rejected by the scanner (F-VAL-01).
- [ ] A QR signed by a wallet that does not own the token is rejected by the scanner.
- [ ] A QR for a burned (used) ticket is rejected by the scanner.
- [ ] The QR display includes a visual countdown or progress indicator showing when the code will rotate.
- [ ] The QR remains visible and rotating even if the device is offline (signing is local; validation against on-chain state happens at the scanner).
- [ ] The buyer can select which ticket to display if they own multiple tickets.

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain** | Provides the source of truth for ownership (who holds the token) and burn status (is the ticket still valid). The contract exposes view functions: `ownerOf(tokenId)` and a burn status check. |
| **Off-chain (buyer app frontend)** | Generates the QR payload at each rotation interval, signs it with the custodial wallet, renders the QR code, displays the countdown. |
| **Off-chain (scanner app — F-VAL-01)** | Reads the QR, recovers the signer address from the signature, compares it to the on-chain owner, checks burn status and timestamp validity. |

## Dependencies

- **F-BUY-01** (Web2.5 Onboarding) — the buyer must have a custodial wallet capable of signing the QR payload.
- **F-VAL-01** (Scanner App) — the scanner is the other half of this feature; it validates what this feature generates.
- **ADR 0009** (Dynamic QR signing scheme) — **blocking dependency**. The signing algorithm, payload structure, rotation interval, and time-window tolerance must be defined before implementation. This ADR must be resolved before M4 development begins.

## Implementation Notes

- **UI prototype only** (`apps/web/src/routes/_authed/tickets/$ticketId.tsx`): the ticket detail page renders a QR code (via the `qrcode` package) that regenerates every 10 seconds with a progress bar/countdown, matching the rotation UX described here.
- **Payload is not cryptographically signed.** The current payload is a plain string (`ticket:{tokenId}:{10s-window-index}`) with no wallet signature — ADR 0009 (signing scheme, rotation interval, clock-skew tolerance) is still unresolved and blocks the real implementation.
- There is no scanner-side verification yet (that's [F-VAL-01](../validator/F-VAL-01-scanner-app.md)), and the ticket's on-chain ownership/status now comes from the real [F-BUY-02](F-BUY-02-marketplace.md) backend — the QR is disabled in the UI once a ticket's status is `listed` or `used`.

## Open Questions

- What is the exact rotation interval, and what time tolerance does the scanner accept (to account for clock skew between the buyer's phone and the scanner)? This is decided in ADR 0009.
- What signing scheme is used? Options: EIP-191 (personal sign), EIP-712 (typed structured data), or a custom scheme. EIP-712 is more structured and human-readable but adds complexity. Decided in ADR 0009.
- How does the custodial wallet sign locally without a network round-trip? The provider (ADR 0007) must support local signing. This is an integration constraint to verify.
- Should the QR encode the event ID and tier for faster scanner processing, or should the scanner derive everything from the contract address + token ID?
- What happens if the buyer's phone clock is significantly off? Should the app display a warning if it detects clock drift?
