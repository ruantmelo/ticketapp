# ADR 0010: Offline Validation Mechanism

| Field | Value |
|-------|-------|
| **Status** | Proposed |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |
| **Blocks** | M4 (F-VAL-02) |

## Context

The scanner app (F-VAL-01) must continue validating tickets when the venue's internet connection drops (F-VAL-02). Signature verification is local and needs no network. However, checking on-chain ownership and burn status requires blockchain access. We need a mechanism to cache or pre-load sufficient state for offline validation, plus a strategy for queuing burns and reconciling conflicts on reconnection.

The mechanism must handle: multiple scanners at the same event, duplicate admissions during offline periods, and a configurable offline duration (target: at least 2 hours).

## Considered Options

### Option A: Full State Cache (pre-fetch all tickets)
- **How it works**: Before the event, the scanner app downloads the full list of token IDs, their owners, and burn status from a backend sync endpoint. During offline operation, all checks use the local cache. Burns are queued locally; on reconnection, queued burns are submitted and the cache is updated.
- **Pros**: Simple to implement; the scanner has all data locally; no cryptographic proofs needed.
- **Cons**: Memory/storage heavy for large events (e.g., 50,000 tickets); the owner data may change between pre-fetch and the event (if secondary sales happen close to the event); no cryptographic guarantee that the cache is complete or untampered.

### Option B: Merkle Snapshot (cryptographic commitment)
- **How it works**: Before the event, the organizer (or backend) constructs a Merkle tree of all valid (unburned) tickets `{contractAddress, tokenId, owner}` and publishes the Merkle root (on-chain or via a signed backend payload). The scanner app downloads the Merkle tree (leaves + proof data). For each scan, the app verifies the ticket's membership in the tree locally using the Merkle proof, checks the owner against the signature, and queues the burn. On reconnection, burns are submitted and a new root can be published.
- **Pros**: Cryptographically verifiable — the cache cannot be tampered with without invalidating the root; compact (the root is small, and the tree can be downloaded once); strong integrity guarantee.
- **Cons**: More complex to implement; requires a tree-generation and distribution pipeline; if ownership changes after snapshot generation (late secondary sale), the snapshot is stale and a valid new owner would be rejected; updating the snapshot mid-event is complex.

### Option C: Lazy Cache with Backend Relay
- **How it works**: The scanner caches each ticket's state on first scan (when online). If offline, it uses the cache for previously-seen tickets. For tickets not in the cache, it cannot validate and must reject (or flag as "unknown — requires connectivity").
- **Pros**: Minimal pre-event setup; no bulk download.
- **Cons**: Cannot validate a never-before-seen ticket while offline (high rejection rate for the first offline scan of each ticket); not suitable for a door scenario where most tickets are scanned only once.

### Option D: Hybrid — Full State Cache + Merkle Root Verification
- **How it works**: Combine Option A (download full state) with Option B (verify against a Merkle root published by the backend or on-chain). The full cache provides fast local lookups; the Merkle root provides integrity assurance that the cache was not tampered with.
- **Pros**: Fast local validation + cryptographic integrity; best of both worlds.
- **Cons**: Highest implementation complexity; requires both the sync endpoint and the Merkle tree generation.

## Decision

**Not yet decided.** This ADR is in **Proposed** status. The decision must be made before M4 development begins.

## Preliminary Recommendation

**Option A (Full State Cache)** for the MVP, with an upgrade path to Option D (Hybrid) post-MVP if tamper-resistance becomes a concern.

Rationale:
- For the MVP, the scanner is a platform-controlled app and the backend is trusted, so the cache integrity risk is low.
- Full state cache is the simplest to implement and handles the primary use case (offline validation for a configurable period).
- The Merkle root verification (Option D) can be added later as a security hardening step without changing the offline validation flow.

## Burn Queue & Conflict Resolution (applies to all options)

Regardless of the cache strategy:

1. **Offline burns**: When a valid ticket is scanned offline, the scanner records the burn locally (timestamp, tokenId, scanner ID) and marks the ticket as burned in the local cache (preventing re-admission by the same scanner).
2. **Cross-scanner deduplication (offline)**: If multiple scanners are offline, they cannot share state. A ticket could be admitted by scanner A and scanner B simultaneously. This is an accepted edge case for offline mode — the conflict is detected on reconnection (only one burn transaction succeeds on-chain; the other scanner flags a duplicate admission).
3. **Reconnection sync**: On reconnection, the scanner submits queued burns in order. For each burn:
   - If the ticket is not yet burned on-chain → submit the burn → success.
   - If the ticket is already burned on-chain (by another scanner) → flag as duplicate admission → log for the organizer.
4. **Cache refresh**: After reconnection, the scanner refreshes its cache from the backend to get the latest ownership and burn state.

## Evaluation Criteria

When deciding, evaluate against:

1. **Event scale**: How many tickets? (Affects whether full-state cache is feasible.)
2. **Offline duration target**: 2 hours? Full event? (Affects cache freshness requirements.)
3. **Trust model**: Is the scanner app fully trusted (platform-controlled), or must the cache be tamper-proof?
4. **Late sales**: Are secondary sales allowed close to event time? (Affects snapshot staleness risk.)
5. **Multi-scanner coordination**: How many scanners per event? (Affects duplicate admission risk.)

## Consequences (pending decision)

- The chosen mechanism determines the pre-event setup workflow (what the organizer or backend must prepare before doors open).
- The burn queue and conflict resolution logic is needed regardless of the cache strategy.
- If Option B (Merkle) or D (Hybrid) is chosen, a tree-generation and distribution pipeline must be built in the backend.
- The offline duration target affects cache size and the staleness window.
