# Team C — Placement Data & Transaction Manager

Authoritative System of Record and custom JSON-file DBMS Engine for the ApniLeap campus placement platform.

## Responsibilities
- **Master Data (C1):** 3NF normalized schema for students, drives, applications, and decisions. Auto-synchronizes profile updates to Team B.
- **Application Transactions & Locking (C2):** ACID transactions, strict 2-Phase Locking (2PL), deadlock prevention, and hash index idempotency deduplication.
- **Atomic Offer Commit & Compensation (C3):** Multi-record atomic commit (seat decrement + application state transition to `OFFER_ISSUED`) and automatic lease compensation on failure.
- **Audit & Recovery (C4):** Append-only immutable audit trail; custom Write-Ahead Log (WAL) with instantaneous Redo/Undo crash recovery (RPO=0s, RTO<1s).
- **Engine Internals:** 100% hand-built custom DBMS with B+Tree (splits & merges), Hash Index (own hash function, bucket chaining, auto-resize), and direct disk persistence. **Zero external DB/ORM packages.**

## Running the Service
- **Default Port:** `3003`
- **Seed Master Data:** `npm run seed`
- **Start Service:** `npm run dev` or `npm start`
- **Run Tests:** `npm test` (Runs 32 Jest unit, contract, and recovery tests)
- **Health Check:** `GET http://localhost:3003/healthz`
