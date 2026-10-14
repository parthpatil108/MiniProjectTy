# ApniLeap Architecture Decision Records (ADRs)

## ADR 001: Standardized Monorepo Architecture with Workspaces

- **Status:** Accepted
- **Context:** The repository originally contained four loose, disorganized subfolders (`team-a`, `team-b`, `team-c`, `team-d`) lacking a unified dependency tree, root lockfile, or shared configuration standards.
- **Decision:** Migrate to a modern npm workspace monorepo:
  - `apps/web`: React 18 / Vite candidate & recruiter portal.
  - `apps/bff`: Node/Express Backend-for-Frontend with rate limiting and security guards.
  - `services/eligibility`: Team A Rule Engine, Queues, and Exclusive Lock Manager.
  - `services/ranking`: Team B Bipartite Graph, Heap Top-K, and AVL Shortlist Index.
  - `services/data-engine`: Team C Hand-built JSON DBMS (B+Tree, Hash Index, WAL, 2PL).
  - `packages/common`: Shared configuration, Pino logging, JWT/service tokens, and response envelopes.
  - `packages/fixtures`: Shared master data fixtures for consistent seeding.
- **Consequences:** Eliminates dependency drift, ensures a single deterministic `package-lock.json`, and allows cross-service typing without code duplication.

---

## ADR 002: Strict Preservation of Academic Data Structures & Algorithms

- **Status:** Accepted
- **Context:** Team C is a graded academic computer science artifact featuring custom hand-built B+Tree indices, extensible hash indexing, Write-Ahead Logging (WAL), and Strict Two-Phase Locking (2PL). Replacing these with third-party databases (SQLite, MongoDB, Postgres) or ORMs (Prisma, TypeORM) would destroy the project's pedagogical core.
- **Decision:** Strictly retain, harden, and complete the hand-built internals:
  - B+Tree: Multi-level page indexing with node splitting, merging, point queries, and range scans.
  - Hash Index: Dynamic bucket chaining with load factor re-hashing and secondary index lookups.
  - Strict 2PL: Concurrency control using Shared/Exclusive locks held until transaction termination.
  - Graph: Bipartite skill matching via both adjacency lists and adjacency matrices.
- **Consequences:** Hand-built components are rigorously unit tested (100% pass) and protected against regressions via automated property-style correctness tests.

---

## ADR 003: Transactional Outbox Pattern & SSE Event Stream

- **Status:** Accepted
- **Context:** Cross-service distributed operations (e.g., student applying for a drive, scheduling an interview lock, syncing skill profiles) cannot rely on distributed transactions (XA 2PC) due to performance overhead and fragility.
- **Decision:** Implement a transactional Outbox pattern in Team C paired with an Outbox worker and Server-Sent Events (SSE) bridge in the BFF:
  - State changes write an `outbox` record inside the same local 2PL transaction as the primary entity.
  - An Outbox worker processes unacknowledged events with exponential backoff and a Dead-Letter Queue (DLQ).
  - BFF exposes an SSE stream (`/api/v1/ui/stream`) with heartbeat packets and `Last-Event-ID` replay.
- **Consequences:** Guarantees at-least-once delivery, fault tolerance against service restarts, and real-time live UI updates without polling.

---

## ADR 004: Real Database Authentication and Fail-Closed RBAC

- **Status:** Accepted
- **Context:** The original application trusted client-submitted headers (`X-Role`, `X-User-ID`) or relied on hardcoded mock tokens, enabling complete privilege escalation.
- **Decision:** Implement an institutional authentication system backed by Team C's `users` table:
  - Passwords hashed using Node native `crypto.scrypt` with cryptographic salts.
  - Role derived strictly from verified database records.
  - Short-lived JWT access tokens (15m) + httpOnly refresh tokens in strict cookies.
  - Service-to-service communication authenticated using HMAC-SHA256 tokens (`X-Service-Token`).
- **Consequences:** Prevents privilege escalation, blocks credential brute forcing, and complies with modern OWASP authentication standards.

---

## ADR 005: Accessible React Component System with Zero Mock Fallbacks

- **Status:** Accepted
- **Context:** The frontend contained multiple mock fallbacks that displayed hardcoded placeholder tables when backend endpoints returned errors. This masked critical integration bugs.
- **Decision:** Eliminate all mock fallbacks in favor of a resilient design system:
  - React Router DOM for declarative URL-based routing.
  - TanStack Query for cache invalidation, background refetching, and error handling.
  - Accessible design system (`Button`, `Modal`, `Input`, `Badge`, `Toast`, `Skeleton`) conforming to WCAG standards with focus trapping and ARIA attributes.
- **Consequences:** Ensures the UI reflects true server state at all times; operational errors trigger visible alerts and retry affordances rather than misleading dummy mock data.

---

## ADR 006: Atomic Two-Phase Disk Durability for Custom DBMS

- **Status:** Accepted
- **Context:** File writes using unbuffered or non-synced `fs.writeFileSync` risk corruption if the OS crashes or loses power mid-write.
- **Decision:** Implement atomic file durability in `StorageTable.saveToFile`:
  1. Write serialized JSON records to a unique temporary file (`.table.tmp`).
  2. Invoke `fs.fsyncSync(fd)` to flush OS buffers to physical non-volatile storage.
  3. Close file descriptor and execute atomic rename (`fs.renameSync`).
- **Consequences:** Eliminates partially written or truncated table files during crashes; verified via dedicated crash-recovery integration tests.
