# F-VAL-02 — Offline Mode / Cache

| Field | Value |
|-------|-------|
| **ID** | F-VAL-02 |
| **Persona** | Validator / Door Staff |
| **Milestone** | M4 |
| **Priority** | Medium |
| **Status** | Not Started |

## Summary

A resilience mechanism that allows the scanner app to continue validating tickets when the venue's internet connection drops. The app caches the necessary on-chain state (ownership and burn data) so that signature and ownership verification can proceed locally, with burn transactions queued for submission once connectivity is restored.

## User Story

As a door staff member, I want the scanner to keep working even if the venue's internet goes down, so that the entry line is not halted and attendees are not stranded outside due to a connectivity issue.

## Acceptance Criteria

- [ ] The app pre-fetches and caches on-chain ownership and burn state for the active event's tickets before the event begins (or when connectivity is available).
- [ ] When offline, the app can verify the QR signature locally (no network needed for signature recovery).
- [ ] When offline, the app checks ownership and burn status against the local cache instead of live on-chain queries.
- [ ] Burn actions performed while offline are queued locally and submitted to the blockchain once connectivity is restored.
- [ ] The queued burns are deduplicated — a ticket scanned and "burned" offline cannot be admitted again by another scanner or a second scan.
- [ ] When connectivity is restored, queued burns are submitted in order, and any conflicts (e.g., a ticket that was already burned by another scanner) are resolved and surfaced.
- [ ] The app clearly indicates its connectivity state (online / offline / syncing) in the UI.
- [ ] The app warns the organizer/admin if the cache is stale or incomplete for the active event.
- [ ] The cache has a configurable TTL or invalidation strategy so that stale data does not cause incorrect admissions.
- [ ] The app can validate for a minimum configurable period (e.g., 2 hours) while fully offline without data loss.

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain** | No new on-chain logic. The contract's view functions (`ownerOf`, burn status) are the data source for the cache. Queued burn transactions are submitted to the existing contract burn function. |
| **Off-chain (mobile app)** | Local cache storage (e.g., SQLite, AsyncStorage, or a local encrypted store), cache population strategy, offline signature verification, burn queue management, sync/conflict resolution on reconnection. |
| **Off-chain (backend)** | May provide a pre-event data snapshot (list of token IDs + owners + burn status) for bulk cache population. May act as the sync target for queued burns if the app relays through the backend. |

## Dependencies

- **F-VAL-01** (Scanner App) — this feature is an extension of the scanner app's resilience.
- **F-BUY-04** (Dynamic Ticket QR) — signature verification works offline (local), so the QR scheme must support local verification.
- **ADR 0010** (Offline validation mechanism) — **blocking dependency**. The caching strategy (cached proofs vs Merkle snapshots vs full state replication) and the conflict resolution policy must be defined before implementation.

## Open Questions

- What is the cache strategy? Options (decided in ADR 0010):
  - **Full state cache**: pre-fetch all token IDs + owners + burn status for the event. Simple but memory-heavy for large events.
  - **Merkle snapshot**: the organizer publishes a Merkle root of valid tickets pre-event; the app downloads the tree and verifies membership locally. Compact and cryptographically verifiable, but more complex.
  - **Lazy cache with fallback**: cache on first scan, fall back to a backend relay when online. Does not help for the first offline scan of a ticket.
- How are multiple scanners reconciled when they come back online? If scanner A and scanner B both admit (and queue-burn) the same ticket offline, only one burn succeeds on-chain. The other must be flagged as a duplicate admission. Is this a security problem (two people entered with one ticket) or an acceptable edge case?
- What is the maximum offline duration the system should support? This affects cache size and battery life.
- Should the app download the event's ticket state via a sync endpoint (fast, bulk) or via direct on-chain queries (decentralized but slower)? This is related to ADR 0010.
- How does the organizer know when a scanner's cache is ready for the event? Need a "cache ready" indicator.
