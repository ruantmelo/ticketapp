# F-BUY-01 — Web2.5 Onboarding (Custodial Wallet)

| Field | Value |
|-------|-------|
| **ID** | F-BUY-01 |
| **Persona** | Buyer / Fan |
| **Milestone** | M3 |
| **Priority** | High |
| **Status** | In Progress |

## Summary

A registration and login flow that lets buyers sign up with email and password and automatically receives a custodial (invisible) wallet. The user never sees a seed phrase, wallet address, or gas concept. This is the foundational Web2.5 layer that makes the platform accessible to non-technical users.

## User Story

As a buyer, I want to register with my email and password and immediately be able to buy and hold tickets, so that I do not need to understand wallets, seed phrases, or blockchain to use the platform.

## Acceptance Criteria

- [ ] The user can register with an email address and password.
- [ ] On registration, a custodial wallet is automatically provisioned for the user (no user action required).
- [ ] The wallet address is never displayed to the user in the primary UI (it may be visible in an "advanced" settings section, but is not required).
- [ ] The user never encounters a seed phrase or private key prompt during onboarding.
- [ ] The user can log back in with the same credentials and access their wallet and tickets.
- [ ] The platform can sign transactions on behalf of the user (using the custodial wallet) without prompting the user for a wallet password or signature.
- [ ] Session management: the user stays logged in across sessions (with a reasonable expiry).
- [ ] Account recovery: if the user loses access to their email account, there is a defined recovery path (see Open Questions).

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain** | No direct on-chain logic. The custodial wallet is a standard EOA (externally owned account) or smart-contract wallet that interacts with the blockchain. |
| **Off-chain (backend)** | Manages the custodial wallet provider integration, creates wallets on user registration, securely stores/escrows private keys (or delegates to the provider), and signs transactions on behalf of the user. Handles auth (email/password) and session management. |
| **Off-chain (frontend)** | Renders login/registration forms, displays post-login state (tickets, marketplace). |

## Dependencies

- **ADR 0007** (Custodial wallet provider) — **blocking dependency**. The choice of provider (Web3Auth, Magic.link, Particle, or a custom solution) determines the backend integration, key management approach, and recovery mechanisms. This ADR must be resolved before implementation begins.
- **F-BUY-02** (Integrated Marketplace) — depends on this feature for wallet provisioning and transaction signing.
- **F-BUY-03** (FIAT Payments) — depends on this feature for the wallet that receives purchased tickets.

## Implementation Notes

- **Auth exists**; the custodial wallet does not. Registration/login are implemented (`apps/web/src/routes/_auth/{login,register}.tsx`, `apps/api/src/auth/routes.ts`), but no per-user wallet is provisioned on signup.
- **Dev stopgap in place of ADR 0007**: until a real custodial wallet provider is chosen, [F-BUY-02](F-BUY-02-marketplace.md) uses a single shared on-chain signer (`BUYER_CUSTODIAL_PRIVATE_KEY`, `apps/api/src/services/marketplace.service.ts`) to act on behalf of every buyer — the same pattern the organizer side already uses for `CHAIN_PRIVATE_KEY`. This is omnibus custody (one on-chain address, many app-level owners tracked in the database), explicitly not a solution to ADR 0007 — it only unblocks exercising the real marketplace contract end-to-end in dev/local.
- ADR 0007 itself remains **Proposed** (not decided); real per-user custodial wallets, gas-fee strategy, and account recovery are still open.

## Open Questions

- What is the account recovery flow if a user loses email access? Options: backup email, phone number (SMS OTP), or a platform-level recovery process. LGPD implications in Brazil.
- Should the platform offer an optional "export to self-custody" feature for advanced users who want to eventually hold their own keys? (Post-MVP consideration.)
- How are gas fees handled for user transactions? Options: (a) platform subsidizes all gas, (b) gas is baked into the FIAT ticket price, (c) the platform uses a gasless/ meta-transaction relayer. This intersects with F-BUY-03.
- Is email/password auth handled in-house or via a service (e.g., Auth0, Firebase Auth, Supabase Auth)?
