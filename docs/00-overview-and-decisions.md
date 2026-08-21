# 00 — Overview, Ownership, and Locked Decisions
**Project:** ApniLeap — Rule-Based Placement Eligibility and Performance Analytics
**Scope of this package:** Planning/specification documents for AI coding agents. No application code is included here.
**Project lead:** Parth (also Team C lead)

## 0.1 How to read this package

This package does **not** repeat what the official project description (`RIT_Placement_..._by_GSW.md`, referred to below as "the Project Doc") already defines clearly — missions, per-team feature contracts, API exposure matrices, sequence flows, and KPI tables. Coding agents must treat the Project Doc as the primary source for those items.

Every decision recorded anywhere in this package is tagged with one of the following labels. Agents must not treat labels differently than their definition below:

| Tag | Meaning | Can an agent change it? |
| --- | --- | --- |
| **[PROJECT DOC]** | Already defined in the official Project Doc | No |
| **[LOCKED]** | Decided directly by Parth (project/Team C lead) | No |
| **[SPEC]** | Decided in this documentation package to fill a gap the Project Doc left open | No, without lead approval |
| **[AGENT CHOICE]** | Explicitly left open for the implementing coding agent | Yes, freely, within the stated constraint |
| **[NEEDS CLARIFICATION]** | Unresolved; agent must stop and flag rather than guess | N/A — must escalate |

## 0.2 Locked decisions [LOCKED]

These were set by the project lead and apply project-wide. No coding agent, for any team, may override them.

1. The four-team boundary and ownership model in the Project Doc (Team A = eligibility/scheduling, Team B = ranking/analytics, Team C = data/transactions, Team D = UI/BFF) is final.
2. Parth is overall project lead and Team C lead.
3. **Team C must be a real, working module.** No simulation, mock, hardcoded demo, or partial prototype is acceptable as a final deliverable.
4. **Team C is built entirely in Node.js/JavaScript.**
5. **No existing DBMS product may be used for Team C's authoritative storage.** No SQLite, Postgres, MySQL, MongoDB, etc. No ORMs or embedded-DB libraries that would perform storage, indexing, transaction, locking, or recovery work on Team C's behalf (see §2 of `02-team-c-architecture.md` for the explicit allow/deny package list).
6. **JSON files are the physical persistence layer**, but the application must not manipulate JSON files directly and everywhere. A layered database architecture (storage → index → transaction/concurrency → query → API) must sit in front of it — see `03-team-c-database-engine-design.md`.
7. Team C must genuinely implement: storage management, indexing, a B+Tree, hashing, query processing, transactions, commit/rollback, concurrency/locking, recovery, and audit — as real code, not thin wrappers around a library that already does the work.
8. Ordinary supporting npm packages (web framework, validation, testing, UUID generation, logging) are allowed. Packages that would implement the required DBMS internals are not.
9. Team C owns the authoritative data. Teams A, B, and D interact with it only through Team C's APIs — never through direct storage access.
10. Cross-team API contracts are rigid. No team's coding agent may casually or silently change a shared contract (see `01-shared-contracts-and-data-model.md`).
11. One GitHub repository. Each team manages its own development; each team lead integrates that team's work into the main project. Git workflow stays simple (see `07-testing-integration-and-workflow.md`).
12. Coding agents may make internal implementation decisions but have **no authority** to change architecture, team boundaries, data ownership, technology choices, required algorithms, or shared contracts.
13. Timeline is roughly 1–2 months. Scope must stay realistic; agents should avoid overengineering beyond what is specified.
14. The final system must actually run, be testable, and be demonstrable — including the underlying required concepts (not just a working UI).

## 0.3 System purpose (one line, per the Project Doc)

A rule-driven campus placement eligibility and analytics platform, built by four independently-developed teams that integrate through versioned HTTP/JSON contracts, with Team C as the system of record. **[PROJECT DOC]**

## 0.4 Module map

```
                         ┌───────────────────────────┐
                         │   Team D — Portal / BFF    │
                         │  (any web stack; no DB     │
                         │   requirement of its own)  │
                         └────────────┬───────────────┘
                                      │ HTTPS/JSON (+SSE/WebSocket)
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │ Team A — Eligibility │  │ Team C — Data &     │  │ Team B — Ranking &  │
   │ Rule & Scheduling    │◄─┤ Transaction Manager │─►│ Analytics Engine    │
   │ Engine (any stack)   │  │ (Node.js — custom   │  │ (any stack)         │
   └────────────────────┘  │  JSON-file DBMS)     │  └────────────────────┘
                            └────────────────────┘
```

- Team C is the only team with a hard technology mandate (Node.js + custom storage). **[LOCKED]**
- Team A, B, D technology stacks are **[AGENT CHOICE]** within each team, constrained only by the shared HTTP/JSON contract in `01-shared-contracts-and-data-model.md`. If your course requires a specific stack per team (e.g., OS-team in C, Web-team in JS/HTML), that constraint is **[NEEDS CLARIFICATION]** — not assumed here.

## 0.5 Non-goals / scope guardrails

- No Kubernetes, message brokers (Kafka/RabbitMQ), or distributed consensus. A single-process outbox/audit log satisfies the "asynchronous freshness" requirement.
- No production-grade auth provider (Okta/Auth0/OAuth against a real institutional IdP). A simplified session/JWT scheme is enough for demonstration — see `05-teams-a-b-d-specifications.md`.
- No requirement to survive multi-machine failover. Recovery KPIs (RPO/RTO) are demonstrated on a single instance via WAL replay.
- Do not build generic reusable "framework" code beyond what the Project Doc's feature contracts need. Build the specific features required, correctly.

## 0.6 Document index

| # | Document | Purpose |
| --- | --- | --- |
| 00 | `00-overview-and-decisions.md` | This document. |
| 01 | `01-shared-contracts-and-data-model.md` | The frozen cross-team API contract: envelopes, IDs, state machine, object schemas, error codes, versioning. |
| 02 | `02-team-c-architecture.md` | Team C's layered module architecture, folder structure, allowed/disallowed packages. |
| 03 | `03-team-c-database-engine-design.md` | The custom DBMS: storage, B+Tree, hashing, query processor, transactions, locking, recovery, audit. |
| 04 | `04-team-c-implementation-plan.md` | Build sequence, endpoint-by-endpoint spec, seed data, Team C test plan. |
| 05 | `05-teams-a-b-d-specifications.md` | What Teams A, B, D need beyond the Project Doc to integrate correctly with Team C. |
| 06 | `06-ai-agent-rules.md` | Global and per-team rules of engagement for coding agents. |
| 07 | `07-testing-integration-and-workflow.md` | Test strategy, integration gates, Git workflow. |
| 08 | `08-requirements-traceability.md` | Checklist mapping every major Project Doc requirement to where it is covered. |
