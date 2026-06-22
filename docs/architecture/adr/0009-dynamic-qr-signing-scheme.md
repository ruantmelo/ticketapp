# ADR 0009: Dynamic QR Signing Scheme

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |
| **Blocks** | M4 (F-BUY-04, F-VAL-01) |

## Context

The anti-fraud entry system (F-BUY-04, F-VAL-01) requires a dynamic QR code that:
1. Rotates at a fixed time interval (so screenshots become stale).
2. Is cryptographically signed by the current ticket holder's wallet (so a copied QR cannot be used by a non-owner).
3. Can be verified by the scanner app in under 1 second.
4. Works even when the buyer's phone is offline (signing is local).
5. Tolerates minor clock skew between the buyer's phone and the scanner.

The signing scheme, payload structure, rotation interval, and time-window tolerance must be defined and must be identical on both the buyer app (generator) and the scanner app (verifier).

## Decision Area 1: Signing Scheme

### Option A: EIP-191 (personal_sign / `personal_sign`)
- **Pros**: Simplest; signs an arbitrary byte array; widely supported by wallet providers; the custodial wallet provider (ADR 0007) likely supports it.
- **Cons**: Signs a hashed message — no structured data; the scanner must reconstruct the exact payload to recover the signer.

### Option B: EIP-712 (typed structured data signing)
- **Pros**: Signs a structured, typed object — the payload fields (contract address, tokenId, timestamp) are explicitly typed and named; more human-readable if shown to the user; domain separation prevents cross-application replay.
- **Cons**: More complex to implement; slightly larger payload; must verify the custodial wallet provider supports EIP-712 signing locally.

### Option C: Custom scheme (raw secp256k1 signature over a defined payload)
- **Pros**: Minimal overhead; full control.
- **Cons**: Non-standard; must implement signing and recovery manually; higher risk of implementation errors.

### Recommendation: **EIP-712** — the structured typing makes the payload unambiguous and the scanner verification more robust. Verify that the custodial wallet provider (ADR 0007) supports local EIP-712 signing.

## Decision Area 2: Payload Structure

Proposed payload (to be finalized):

```
{
  contractAddress: address,   // The ticket NFT contract
  tokenId: uint256,           // The specific ticket
  windowIndex: uint256,       // floor(timestamp / interval) — the current time window
}
```

The QR encodes: `{ contractAddress, tokenId, windowIndex, signature }`.

The scanner:
1. Recovers the signer address from `signature` over the EIP-712 typed payload.
2. Queries `ownerOf(tokenId)` on `contractAddress`.
3. Compares signer == owner.
4. Checks that `windowIndex` matches `floor(scannerTime / interval)` within a tolerance of ±1 window.
5. Checks burn status.

## Decision Area 3: Rotation Interval & Time Tolerance

### Interval options:
- **5 seconds**: Very secure against screenshots; but requires the buyer to keep the screen on and the app active; higher signing frequency (battery/CPU impact).
- **10 seconds**: Good balance — a screenshot is stale within 10 seconds; tolerable signing frequency.
- **30 seconds**: Lower battery impact; but a screenshot remains valid for up to 30 seconds (risky at a fast-moving door).

### Tolerance:
- **±0 windows**: Strictest — the QR must be from the exact current window. High rejection rate due to clock skew.
- **±1 window**: Accepts the current window and one prior — tolerates clock skew of up to one interval. Recommended.
- **±2 windows**: More tolerant but allows a screenshot to remain valid for up to 2 intervals.

### Recommendation: **10-second interval, ±1 window tolerance.** This means a QR is valid for 10–20 seconds (current window + 1 prior), and a screenshot is rejected after at most 20 seconds.

## Decision

**Not yet decided.** This ADR is in **Proposed** status. The decision must be made before M4 development begins.

## Preliminary Recommendation

| Parameter | Recommended Value |
|-----------|-------------------|
| Signing scheme | EIP-712 (typed structured data) |
| Payload | `{ contractAddress, tokenId, windowIndex, signature }` |
| Rotation interval | 10 seconds |
| Time tolerance | ±1 window (10–20 seconds validity) |
| Signing location | Local on the buyer's device (custodial wallet must support local EIP-712 signing) |

## Dependencies

- **ADR 0007** (Custodial wallet provider) — the provider must support local EIP-712 signing for the QR to rotate offline. This is a hard constraint to verify.
- **ADR 0008** (NFT standard) — the payload includes `tokenId`, whose semantics depend on the NFT standard (ERC-721 vs ERC-1155).

## Consequences (pending decision)

- Both the buyer app (F-BUY-04) and scanner app (F-VAL-01) must implement the exact same scheme.
- The rotation interval affects battery life on the buyer's phone and the security/fraud-resistance tradeoff.
- The time tolerance requires the scanner to have a reasonably accurate clock (NTP-synced or manual event-time setting).
- If the custodial wallet provider cannot sign locally, the dynamic QR feature (F-BUY-04) must be redesigned (e.g., pre-generated QR windows with server-side signing), which weakens the offline guarantee.
