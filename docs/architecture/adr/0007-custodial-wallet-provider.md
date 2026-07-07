# ADR 0007: Custodial Wallet Provider

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |
| **Blocks** | M3 (F-BUY-01, F-BUY-02, F-BUY-03); production organizer wallet integration for F-ORG-02 |

## Context

The platform's Web2.5 approach requires that buyers register with email/password and automatically receive a wallet whose private keys are managed by the platform. Organizers also need organizer custodial wallets so event ownership and primary sale distribution can happen without requiring organizers to use blockchain tooling. The user never sees a seed phrase. The chosen provider determines: key management security, transaction signing flow (local vs. server-side), account recovery, gas fee handling, and integration complexity with the Node.js backend.

## Considered Options

### Option 1: Web3Auth
- **Pros**: Designed for Web2.5 onboarding; supports social logins (Google, etc.) natively; MPC-based key management (no single party holds the full key); supports both custodial and non-custodial modes; large ecosystem; Node.js SDK.
- **Cons**: MPC architecture adds complexity; recovery flow depends on Web3Auth's infrastructure; pricing scales with MAU.

### Option 2: Magic.link
- **Pros**: Email-based wallet provisioning (passwordless); managed key infrastructure; simple SDK; supports custodial mode; good documentation.
- **Cons**: Fully custodial (Magic holds the keys) — centralization risk; less flexible for custom auth flows; pricing per MAU; recovery tied to Magic's service.

### Option 3: Particle Network
- **Pros**: All-in-one Web2.5 infrastructure (wallet + auth + AA); supports social login; ERC-4337 account abstraction support; Node.js SDK.
- **Cons**: Newer project with a smaller track record than Web3Auth; ecosystem still maturing; some features are Particle-specific (vendor lock-in).

### Option 4: Custom custodial solution (in-house key management)
- **Pros**: Full control; no per-MAU costs; can integrate with any auth provider.
- **Cons**: High security responsibility (managing private keys is a critical security burden); requires HSM or KMS infrastructure; requires building recovery flows from scratch; highest implementation effort and risk.

## Decision

**Not yet decided.** This ADR is in **Proposed** status. The decision must be made before M3 development begins.

## Evaluation Criteria

When deciding, evaluate each option against:

1. **Security**: How are private keys stored? (MPC, HSM, KMS, plaintext?) What is the attack surface?
2. **Local signing**: Can the buyer app sign the dynamic QR (F-BUY-04) locally without a network round-trip? This is a hard requirement — the QR must rotate even offline.
3. **Gas handling**: Does the provider support gasless/meta-transactions, or must the platform fund the custodial wallets?
4. **Account recovery**: What happens if a user loses email access? How is LGPD compliance maintained?
5. **Cost**: Per-MAU pricing vs. self-hosted cost.
6. **Vendor lock-in**: How difficult is it to migrate away from the provider later?
7. **Node.js integration**: Quality of the backend SDK for transaction signing and event listening.

## Preliminary Recommendation

**Web3Auth** appears to be a strong candidate due to its MPC architecture (better security than full custodial) and ability to support local signing for the dynamic QR feature. However, the local signing capability for the QR rotation (F-BUY-04) must be verified against Web3Auth's SDK before committing.

## Consequences (pending decision)

- The chosen provider determines the backend's wallet management module.
- The provider must support local signing in the buyer app for the dynamic QR (F-BUY-04) — if it does not, the QR feature design must change.
- Gas fee handling strategy (subsidized, baked into price, or gasless relayer) is coupled to this choice.
- Account recovery and LGPD compliance depend on the provider's mechanisms.
