# 08 — Requirements Traceability

A checklist mapping every major requirement category from the Project Doc (and from the locked decisions in doc 00) to where it is covered in this documentation package, so nothing gets lost before an agent starts building. Update the "Status" column as implementation proceeds — this document is meant to be a living checklist, not a one-time artefact.

## 8.1 Cross-team standards

| Requirement | Source | Covered by | Status |
| --- | --- | --- | --- |
| Common request headers, response envelope | Project Doc §3.1–3.2 | Doc 01 §1.1 | Defined |
| Correlation ID propagation | Project Doc §1.1, §3.1 | Doc 01 §1.1 | Defined |
| Idempotency-Key semantics | Project Doc §3.1 | Doc 01 §1.1 | Defined |
| Cross-team data object schemas | Project Doc §3.3 (minimum fields only) | Doc 01 §1.3 (full field-level shape) | Elaborated |
| Application state machine | Project Doc §3.4 (sequence only) | Doc 01 §1.4 (full transition table) | Elaborated |
| Error code vocabulary | Project Doc (one example) | Doc 01 §1.2 | Elaborated |
| API versioning policy | Project Doc §7.1 | Doc 01 §1.5 | Elaborated |

## 8.2 Team C — required DBMS concepts

| Requirement | Source | Covered by | Status |
| --- | --- | --- | --- |
| Storage management | Locked decision (doc 00 §0.2.7) | Doc 03 §3.2–3.3 | Defined |
| JSON persistence via layered architecture (not direct manipulation) | Locked decision (doc 00 §0.2.6) | Doc 02 §2.1, Doc 03 §3.2 | Defined |
| Indexing | Locked decision | Doc 03 §3.11 | Defined |
| B+Tree | Locked decision | Doc 03 §3.4 | Defined |
| Hashing | Locked decision | Doc 03 §3.5 | Defined |
| Query processing | Locked decision | Doc 03 §3.9 | Defined |
| Transactions / commit / rollback | Locked decision | Doc 03 §3.7 | Defined |
| Concurrency / locking | Locked decision | Doc 03 §3.8 | Defined |
| Recovery | Locked decision + Project Doc KPI (RPO/RTO) | Doc 03 §3.6 | Defined |
| Audit | Locked decision + Project Doc C4 | Doc 03 §3.10 | Defined |
| No external DBMS / disallowed packages | Locked decision (doc 00 §0.2.5) | Doc 02 §2.4 | Defined |

## 8.3 Team feature contracts (C1–C4, A1–A4, B1–B4, D1–D4)

| Requirement | Source | Covered by | Status |
| --- | --- | --- | --- |
| Team A feature contracts A1–A4 | Project Doc §4.1 | Referenced as-is; integration mechanics in Doc 05 §5.1 | Defined (Project Doc) + integration detail added |
| Team B feature contracts B1–B4 | Project Doc §4.2 | Referenced as-is; integration mechanics in Doc 05 §5.2 | Defined (Project Doc) + integration detail added |
| Team C feature contracts C1–C4 | Project Doc §4.3 | Docs 02, 03, 04 (architecture, engine, endpoint spec) | Fully elaborated |
| Team D feature contracts D1–D4 | Project Doc §4.4 | Referenced as-is; integration + auth detail in Doc 05 §5.3 | Defined (Project Doc) + integration detail added |

## 8.4 Process requirements

| Requirement | Source | Covered by | Status |
| --- | --- | --- | --- |
| Integration/delivery phases | Project Doc §7 | Doc 07 §7.2 | Referenced + operationalized |
| Team-to-team handoff checklist | Project Doc §7.1 | Doc 05 (per-team), Doc 07 §7.1 | Referenced + operationalized |
| Simple Git workflow, one repo | Locked decision (doc 00 §0.2.11) | Doc 07 §7.3 | Defined |
| Definition of done | Project Doc §6.1 | Doc 07 §7.4 (pointer) | Referenced |
| Assessment evidence per team | Project Doc §8 | Doc 04 §4.4 (Team C detail); other teams per Project Doc | Referenced + Team C elaborated |
| AI agent authority limits | Locked decision (doc 00 §0.2.12) | Doc 06 | Defined |

## 8.5 Open clarifications (consolidated)

Pulled from every document — resolve these with the affected team leads before the relevant milestone:

1. **Doc 00 §0.4:** Whether Teams A, B, D have a course-mandated technology stack per their subject area (OS/DS/Web), or are genuinely free choice.
2. **Doc 05 §5.1:** Whether Team A notifies Team C via callback (push) or Team C polls — default assumption is polling until resolved.
3. **Doc 05 §5.3:** How the shared JWT-signing secret between Team D and Teams A/B/C is distributed (repo config file, `.env.example`, manual step).
4. **Doc 05 §5.3:** Team C needs an additional internal outbox-tailing endpoint (`GET /internal/v1/outbox/stream` or equivalent) not present in the Project Doc's Team C API matrix — needs lead sign-off before Team D's live-dashboard work (D3) depends on it.

## 8.6 How to keep this current

Whenever a document in this package is amended (a clarification gets resolved, a new shared-contract field is added), update the corresponding row here. If a resolution changes a tag from **[NEEDS CLARIFICATION]** to **[SPEC]**/**[LOCKED]** in its source document, mirror that status change in §8.5 by moving the item out of the open list.
