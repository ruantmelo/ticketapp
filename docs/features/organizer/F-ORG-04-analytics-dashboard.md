# F-ORG-04 — Analytics Dashboard

| Field | Value |
|-------|-------|
| **ID** | F-ORG-04 |
| **Persona** | Organizer / Producer |
| **Milestone** | M5 |
| **Priority** | Medium |
| **Status** | Not Started |

## Summary

A real-time dashboard that gives organizers visibility into primary sales, secondary-market trading volume, and attendee data. It aggregates on-chain events (mints, transfers, burns) with off-chain data (user profiles, payment metadata) to provide actionable insights.

## User Story

As an organizer, I want to see real-time data on primary sales, secondary market activity, and my audience, so that I can make informed decisions about pricing, marketing, and future events.

## Acceptance Criteria

- [ ] The dashboard displays real-time primary sale counts per event and per tier.
- [ ] The dashboard displays secondary-market volume: number of resales, total value, and average resale price.
- [ ] The dashboard shows royalty earnings accumulated from secondary sales.
- [ ] The dashboard displays burn/validation counts (tickets used at the door) vs. unscanned tickets.
- [ ] The organizer can filter data by event and by time range.
- [ ] The dashboard shows basic demographic data (derived from buyer profiles): location distribution, age range (if collected).
- [ ] Data updates in near-real-time (within seconds of an on-chain event).
- [ ] The dashboard is accessible from the organizer panel (same auth as F-ORG-01).
- [ ] Data can be exported as CSV for external analysis.

## On-Chain / Off-Chain Split

| Layer | Responsibility |
|-------|----------------|
| **On-chain** | Emits events for all relevant actions (mint, transfer, royalty payment, burn). These events are the raw data source. |
| **Off-chain (backend)** | Indexes on-chain events into a queryable database. Joins on-chain data with off-chain user/payment metadata. Serves aggregated data via API. |
| **Off-chain (frontend)** | Renders charts, tables, and filters. Polls or subscribes to the backend API for real-time updates. |

## Dependencies

- **F-ORG-02** (Minting Engine) — mint events feed the primary sale data.
- **F-BUY-02** (Integrated Marketplace) — transfer events feed the secondary market data.
- **F-BUY-03** (FIAT Payments) — payment metadata enriches the demographic and revenue data.
- **F-VAL-01** (Scanner App) — burn events feed the validation/attendance data.
- An **indexing solution** is needed (e.g., a custom event listener in the Node.js backend, or a subgraph). The indexing approach is an implementation detail to be decided during M5 planning.

## Open Questions

- What demographic data is collected from buyers, and what are the privacy/legal implications (LGPD in Brazil)? Need to define the minimum viable data set.
- Should the dashboard support multiple organizers in a multi-tenant fashion, or is it single-organizer for the MVP?
- What charting library is used in the frontend? (Implementation detail, but should be consistent with the React + Vite stack.)
- Should real-time updates use WebSocket polling, Server-Sent Events, or a polling interval?
