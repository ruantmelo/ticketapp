# F-BUY-03 — FIAT Payments (Pix + Card)

| Field | Value |
|-------|-------|
| **ID** | F-BUY-03 |
| **Persona** | Buyer / Fan |
| **Milestone** | M5 |
| **Priority** | Medium |
| **Status** | In Progress |

## Summary

Integrates Brazilian Pix and credit card payments so that buyers can purchase tickets using FIAT currency without ever holding, seeing, or understanding cryptocurrency. The backend handles the FIAT-to-crypto conversion and executes the blockchain transaction on the user's behalf via their custodial wallet.

## User Story

As a buyer, I want to pay for my ticket with Pix or a credit card just like any normal online purchase, so that I never need to buy crypto or understand blockchain to get my ticket.

## Acceptance Criteria

### Pix
- [ ] The buyer can select Pix as a payment method at checkout.
- [ ] The system generates a Pix QR code / copy-paste code (BR Code) for the exact amount.
- [ ] The buyer pays via their bank app; the backend receives a payment confirmation webhook from the Pix provider.
- [ ] On confirmed payment, the backend executes the on-chain ticket transfer to the buyer's custodial wallet.
- [ ] Pix refunds (for failed/cancelled orders) are supported and documented.

### Credit Card
- [ ] The buyer can enter credit card details via a secure, PCI-compliant checkout widget (no raw card data touches our backend).
- [ ] The card is charged in the display currency (BRL); the backend receives a charge confirmation.
- [ ] On confirmed charge, the backend executes the on-chain ticket transfer.
- [ ] Card refunds are supported.

### General
- [ ] The buyer sees prices in BRL (Brazilian Real) throughout the purchase flow.
- [ ] The buyer never sees cryptocurrency amounts, gas fees, or wallet addresses during checkout.
- [ ] The exchange rate / price conversion is handled transparently in the backend.
- [ ] Failed payments do not result in a ticket transfer (idempotency).
- [ ] Payment status is clearly communicated to the buyer (processing, confirmed, failed).

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain** | The ticket transfer itself (same as F-BUY-02). No FIAT logic on-chain. |
| **Off-chain (backend)** | Integrates with the Pix provider and card processor. Receives payment confirmations. Converts FIAT amounts to the required on-chain value. Executes the blockchain transaction via the user's custodial wallet (gas paid by platform or baked into price). Ensures idempotency (no double-transfer on webhook retries). |
| **Off-chain (frontend)** | Renders payment method selection, Pix QR display, card checkout widget, and payment status. |

## Dependencies

- **F-BUY-01** (Web2.5 Onboarding) — the buyer must have a custodial wallet to receive the ticket after payment.
- **F-BUY-02** (Integrated Marketplace) — the checkout flow is part of the marketplace purchase.
- **F-ORG-02** (Minting Engine) — the tickets being purchased are minted NFTs.

## Implementation Notes

- **UI prototype only** (`apps/web/src/routes/_authed/checkout/$eventId.tsx`): the "Pagamento" step lets the buyer pick Pix or Cartão. Pix shows a static fake QR placeholder and a fake copia-e-cola code; Cartão shows unvalidated fake input fields. Confirming payment calls the real [F-BUY-02](F-BUY-02-marketplace.md) purchase endpoints directly (no payment method is actually sent to or used by the backend) — the ticket transfer/purchase itself is real, but there is no Pix/card charge behind it.
- No real Pix/card provider, webhook handling, currency conversion, or idempotency logic exists — all open questions below remain unresolved.

## Open Questions

- **Pix provider**: Which provider/gateway is used? Options: Mercado Pago, PagSeguro, Stripe (Brazil), Banco do Brasil API, or a direct SPI integration. This decision is documented in this feature spec (not a standalone ADR) and should consider: fees, webhook reliability, BR Code generation, and refund support.
- **Card processor**: Which processor? Options: Stripe, Mercado Pago, PagSeguro. Must support Brazil-issued cards and international cards.
- **Currency conversion**: Is the on-chain price denominated in a stablecoin (e.g., USDC), in ETH, or in a fiat-pegged mechanism? A stablecoin is recommended to avoid price volatility between payment and on-chain execution.
- **Gas fee handling**: Who pays gas for the custodial wallet's ticket-receiving transaction? Options: (a) platform subsidizes, (b) included in ticket price markup, (c) gasless meta-transaction relayer. This must be decided alongside the custodial wallet architecture (ADR 0007).
- **Idempotency**: How are webhook retries and edge cases (payment confirmed but on-chain tx fails) handled? Need a reconciliation process.
