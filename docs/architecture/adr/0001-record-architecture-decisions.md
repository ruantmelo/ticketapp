# ADR 0001: Record Architecture Decisions

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-06-22 |
| **Deciders** | Project team |

## Context

This project involves multiple technology choices across smart contracts, web frontend, web3 client, backend, and mobile layers. These decisions have long-term consequences and need to be documented in a way that future contributors can understand not just *what* was chosen, but *why*.

## Decision

We will adopt the Architecture Decision Record (ADR) format, based on Michael Nygard's template. Each ADR:

- Has a sequential number (`0001`, `0002`, ...).
- Has a status: `Proposed`, `Accepted`, `Rejected`, `Deprecated`, or `Superseded`.
- Documents the context, the considered options, and the rationale for the decision.
- Is stored in `docs/architecture/adr/` as a Markdown file.

ADRs are immutable once Accepted — if a decision is reversed, a new ADR supersedes the old one (status changes to `Superseded` with a link to the replacement).

## Consequences

- Every significant technical decision is traceable.
- New team members can onboard by reading the ADR history.
- We accept the overhead of writing and maintaining ADRs in exchange for decision clarity.
- Minor implementation details do not require ADRs; only architecturally significant choices do.
