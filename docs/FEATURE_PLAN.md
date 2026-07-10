# Feature Plan — Master Tracker

This is the single source of truth for feature development status. Update the **Status** column as work progresses. Each feature links to a detailed spec document.

## Status Legend

| Status | Meaning |
|--------|---------|
| `Not Started` | No work has begun. |
| `In Progress` | Actively being developed. |
| `Blocked` | Development is blocked by a dependency or open decision. |
| `Done` | Complete and verified. |

F-ORG-02 has local Hardhat + API + frontend minting validated, with Amoy smoke documented. It remains `In Progress` until Polygon Amoy execution is validated and F-BUY-02 marketplace readiness is available.

## Priority Legend

| Priority | Meaning |
|----------|---------|
| `High` | Core to the MVP. The platform cannot function without it. |
| `Medium` | Important but not blocking the MVP. |
| `Low` | Nice-to-have, enhancement, or post-MVP. |

## Feature Status Board

### Organizer / Producer

| ID | Feature | Priority | Milestone | Status | Spec |
|----|---------|----------|-----------|--------|------|
| F-ORG-01 | Event Creation Panel | High | M2 | In Progress | [spec](features/organizer/F-ORG-01-event-creation-panel.md) |
| F-ORG-02 | Minting Engine | High | M1, M2 | In Progress | [spec](features/organizer/F-ORG-02-minting-engine.md) |
| F-ORG-03 | Secondary Market Configuration | High | M1, M2 | In Progress | [spec](features/organizer/F-ORG-03-secondary-market-config.md) |
| F-ORG-04 | Analytics Dashboard | Medium | M5 | Not Started | [spec](features/organizer/F-ORG-04-analytics-dashboard.md) |

### Buyer / Fan

| ID | Feature | Priority | Milestone | Status | Spec |
|----|---------|----------|-----------|--------|------|
| F-BUY-01 | Web2.5 Onboarding (Custodial Wallet) | High | M3 | In Progress | [spec](features/buyer/F-BUY-01-web2-onboarding.md) |
| F-BUY-02 | Integrated Marketplace | High | M3 | In Progress | [spec](features/buyer/F-BUY-02-marketplace.md) |
| F-BUY-03 | FIAT Payments (Pix + Card) | Medium | M5 | In Progress | [spec](features/buyer/F-BUY-03-fiat-payments.md) |
| F-BUY-04 | Dynamic Ticket QR (Anti-Print) | High | M4 | In Progress | [spec](features/buyer/F-BUY-04-dynamic-ticket-qr.md) |

### Validator / Door Staff

| ID | Feature | Priority | Milestone | Status | Spec |
|----|---------|----------|-----------|--------|------|
| F-VAL-01 | Scanner App | High | M4 | Not Started | [spec](features/validator/F-VAL-01-scanner-app.md) |
| F-VAL-02 | Offline Mode / Cache | Medium | M4 | Not Started | [spec](features/validator/F-VAL-02-offline-cache.md) |

## Summary

| Metric | Count |
|--------|-------|
| Total features | 10 |
| High priority | 7 |
| Medium priority | 3 |
| Done | 0 |
| In Progress | 7 |
| Blocked | 0 |
| Not Started | 3 |

## Blocked Items

_None currently. If a feature becomes blocked, list it here with the blocking dependency or ADR._

## Open Decisions Affecting Features

| ADR | Decision needed | Features affected | Status |
|-----|-----------------|-------------------|--------|
| [0007](architecture/adr/0007-custodial-wallet-provider.md) | Custodial wallet provider | F-BUY-01, F-BUY-02, F-BUY-03 | Proposed |
| [0008](architecture/adr/0008-nft-standard-and-royalties.md) | NFT standard, royalties, transfer restrictions | F-ORG-02, F-ORG-03, F-BUY-02 | Accepted |
| [0009](architecture/adr/0009-dynamic-qr-signing-scheme.md) | Dynamic QR signing & rotation | F-BUY-04, F-VAL-01 | Proposed |
| [0010](architecture/adr/0010-offline-validation-mechanism.md) | Offline validation mechanism | F-VAL-02 | Proposed |
