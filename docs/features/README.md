# Feature Specifications

This directory contains detailed specifications for every feature in the platform. Features are organized by the persona they primarily serve.

## ID Scheme

Every feature has a unique ID following the pattern `F-<PERSONA>-<NN>`:

| Prefix | Persona |
|--------|---------|
| `F-ORG` | Organizer / Producer |
| `F-BUY` | Buyer / Fan |
| `F-VAL` | Validator / Door Staff |

`<NN>` is a zero-padded sequential number within the persona group.

## Spec Template

Each feature spec follows this structure:

- **Summary** — what the feature does, in one or two sentences.
- **User story** — "As a [persona], I want [capability] so that [benefit]."
- **Acceptance criteria** — a checklist of testable conditions that must be met.
- **On-chain / off-chain split** — which parts of the feature are smart contract logic vs. backend/frontend logic.
- **Dependencies** — links to other feature IDs or ADRs this feature relies on.
- **Open questions** — unresolved design decisions specific to this feature.

## Directory Structure

```
features/
├── README.md                          (this file)
├── organizer/
│   ├── F-ORG-01-event-creation-panel.md
│   ├── F-ORG-02-minting-engine.md
│   ├── F-ORG-03-secondary-market-config.md
│   └── F-ORG-04-analytics-dashboard.md
├── buyer/
│   ├── F-BUY-01-web2-onboarding.md
│   ├── F-BUY-02-marketplace.md
│   ├── F-BUY-03-fiat-payments.md
│   └── F-BUY-04-dynamic-ticket-qr.md
└── validator/
    ├── F-VAL-01-scanner-app.md
    └── F-VAL-02-offline-cache.md
```

## Cross-Reference

For the live status of each feature, see [FEATURE_PLAN.md](../FEATURE_PLAN.md). For milestone groupings, see [roadmap.md](../roadmap.md).
