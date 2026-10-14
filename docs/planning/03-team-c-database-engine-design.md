# 03 — Team C Custom Database Engine Design

This is the specification for the "database" the project brief requires Team C to build itself. Every subsystem listed here must exist as real, testable code. A subsystem that is secretly a thin wrapper around `Array.prototype` methods, with no real algorithm behind it, does not satisfy the requirement — the review explicitly assesses "ACID behavior, integrity, query performance and recovery" as engineering artefacts (Project Doc §8).

## 3.1 Design goals **[LOCKED]**

- Real storage manager, real B+Tree, real hash index, real query processor, real transaction manager with commit/rollback, real concurrency control, real WAL-based recovery, real append-only audit log.
- JSON files are the on-disk format. Nothing above the Storage Engine layer (L5, see doc 02) may open or edit a JSON file directly.
- Scope must stay realistic for 1–2 months. Simplifications are allowed where noted **[AGENT CHOICE]**, but never by deleting a required subsystem — only by narrowing its ambition (e.g., a B+Tree with a small fixed order is fine; a B+Tree replaced by a sorted array is not).

## 3.2 Physical persistence layout **[SPEC]**

```
data/
  students.json            # array of Student records
  drives.json               # array of Drive records
  applications.json          # array of Application records
  decisions_cache.json         # last-known EligibilityDecision per application (Team C's copy)
  rankings_cache.json           # last-known RankingResult per drive (Team C's copy)
  audit.jsonl                    # append-only, one JSON object per line — never rewritten in place
  outbox.jsonl                     # append-only, consumed by the SSE/WebSocket publisher
  wal.log                            # write-ahead log, append-only, replayed on startup
  wal.checkpoint                       # last committed LSN checkpointed to the table files
```

Each table file (`students.json`, `drives.json`, `applications.json`) holds a JSON array of records. Each record carries:
```
{
  "_id": "<uuid>",           // internal row identifier, distinct from any public id if you choose to differ
  "_version": 1,               // optimistic-concurrency counter, bumped on every committed write
  "_createdAt": "...",
  "_updatedAt": "...",
  ...domain fields...
}
```
Table files are only ever rewritten by the Storage Engine's checkpoint routine (§3.6), never by an in-place per-request save — every committed change goes through the WAL first.

## 3.3 Storage Manager **[SPEC]**

Responsibilities:
- Load each table into an in-memory record set at startup (after WAL replay, §3.6).
- Provide `insert(table, record)`, `update(table, id, patch, expectedVersion)`, `delete(table, id)`, `getById(table, id)` as the only ways to touch a table's data. These are called exclusively by the Transaction Manager (L3), never directly by services (L2).
- Maintain the indexes (§3.4, §3.5) incrementally as records change — an index is never rebuilt from scratch on every read.
- `update`/`delete` must check `expectedVersion` against the record's current `_version` and raise a `VERSION_MISMATCH`-class error on mismatch (this is what backs `STATE_CONFLICT` / `VERSION_MISMATCH` in doc 01 §1.2).

## 3.4 B+Tree index **[LOCKED — must be a real B+Tree]**

**Where it's used:** range and ordering queries — e.g. applications filtered/sorted by `drive_id` + `created_at`, students filtered by `cgpa` range for eligibility criteria checks, drives filtered by `state`.

**Required properties of the implementation:**
- Configurable order (branching factor) — **[AGENT CHOICE]** on the exact number (order 4–64 is all reasonable for this data scale), but it must be a real parameter, not hardcoded to 2 (which would just be a binary tree pretending to be a B+Tree).
- Internal nodes hold only keys + child pointers; leaf nodes hold keys + values (or record ids) and are linked (leaf-to-leaf) to support efficient range scans without walking back up the tree.
- Real `insert` with node splitting when a node exceeds order, propagating splits upward, and creating a new root when the root splits.
- Real `delete` with underflow handling — at minimum, borrowing from a sibling or merging nodes when a node drops below the minimum fill factor. (A delete that merely marks-and-ignores underflow without ever merging/borrowing is not acceptable; the tree must not degrade into an unbalanced structure over the life of a demo run.)
- `rangeQuery(low, high)` implemented via leaf traversal, not by falling back to a full table scan.
- Unit tests must demonstrate: insert causing a split, delete causing a merge/borrow, and a range query returning correctly ordered results after several inserts/deletes.

**Indexed fields (initial set) — [SPEC, agent may extend]:**
| Table | Field | Index type |
| --- | --- | --- |
| `applications` | `drive_id` | B+Tree (many applications per drive; supports range/listing) |
| `applications` | `created_at` | B+Tree (supports report date-range queries) |
| `students` | `cgpa` | B+Tree (supports eligibility/criteria range checks) |

## 3.5 Hash index **[LOCKED — must be a real hash table]**

**Where it's used:** exact-match, high-frequency primary-key-style lookups — e.g. fetch application by `application_id`, fetch student by `student_id`, fetch drive by `drive_id`, idempotency-key lookup.

**Required properties:**
- Real hash function over the key (a simple, documented string hash — e.g. FNV-1a or djb2 — implemented by the agent, not `Map` used as if it were the "implementation").
- Explicit bucket array with **chaining** for collision resolution (or open addressing with probing — pick one and document it).
- Resize/rehash when load factor crosses a threshold (e.g. > 0.75), so performance doesn't degrade under the KPI's concurrent-load tests.
- `get(key)`, `put(key, value)`, `remove(key)` with O(1) average case, demonstrated in a benchmark test (see `04-team-c-implementation-plan.md` test plan).

**Indexed fields:**
| Table | Field | Index type |
| --- | --- | --- |
| `applications` | `application_id` | Hash |
| `applications` | `idempotency_key` | Hash |
| `students` | `student_id` | Hash |
| `drives` | `drive_id` | Hash |

> Note: using a plain JavaScript `Map` for this index does **not** satisfy the "genuinely implement hashing" requirement — `Map`'s hashing is V8's, not yours. Build the bucket array and hash function explicitly. It is fine to use a plain array/object only as the underlying bucket storage.

## 3.6 Write-Ahead Log and Recovery **[LOCKED]**

**Commit protocol:**
1. Transaction Manager assembles all the record-level changes for a transaction (e.g., for C3's offer commit: application state change + seat/slot decrement + audit record + outbox event).
2. Before any in-memory table or index is mutated, every change is appended to `wal.log` as one log record per change, tagged with a transaction id and a monotonically increasing LSN (log sequence number), followed by a `COMMIT <txnId>` record once all changes are appended.
3. Only after the `COMMIT` record is durably appended (flushed to disk) does the Storage Manager apply the changes to in-memory tables/indexes.
4. If any step before the `COMMIT` record fails, the transaction is aborted: nothing is applied, and an `ABORT <txnId>` record is appended so recovery never misinterprets a partial log as a completed transaction.

**Recovery (on process restart):**
1. Load the last checkpoint (`wal.checkpoint`, which records the LSN up to which table files are known-consistent) and load table files as of that checkpoint.
2. Replay every WAL record after that LSN: apply changes belonging to committed transactions in order; ignore changes belonging to transactions that never reached a `COMMIT` record.
3. Write a fresh checkpoint once replay completes.

**Checkpointing:** periodically (e.g., every N committed transactions or on clean shutdown), flush the current in-memory table state to the JSON table files and advance `wal.checkpoint`, then it's safe to truncate/rotate the WAL up to that point.

This is what the Project Doc's Recovery KPI (RPO ≤ 5 min, RTO ≤ 30 min) is demonstrated against — the fault-injection test kills the process mid-transaction and shows the WAL replay leaves the DB in a consistent state with at most the last uncommitted transaction lost.

## 3.7 Transaction Manager, Isolation, and Commit/Rollback **[LOCKED]**

- `beginTransaction()` returns a transaction handle.
- `read(table, id, txn)` / `write(table, id, patch, txn)` stage changes against the transaction; nothing is visible to other transactions until commit.
- `commit(txn)` runs the WAL protocol in §3.6, then releases all locks held by the transaction (§3.8).
- `rollback(txn)` discards staged changes and releases locks without ever writing them, appending an `ABORT` record.
- **Isolation level: Serializable, implemented via strict two-phase locking (2PL)** — a transaction acquires all locks it needs before making changes and holds them until commit/rollback (no early release). **[SPEC — this is the concrete choice satisfying the Project Doc's "explicit isolation/locking strategy" requirement for C2]**
- Multi-record atomicity: C3 (offer commit) is the canonical example — application state, seat/slot count, audit record, and outbox event must all be staged under one transaction and become visible together or not at all.
- Idempotency: before starting a new transaction for a `POST` that carries an `Idempotency-Key`, the Transaction Manager checks the hash index (§3.5) for that key; if found, it returns the previously committed response instead of re-executing — this is what guarantees "a retry with the same idempotency key must not create a second application."

## 3.8 Concurrency Control / Lock Manager **[LOCKED]**

- Per-record shared (read) and exclusive (write) locks, keyed by `(table, recordId)`.
- Lock compatibility: multiple shared locks may coexist; an exclusive lock excludes all others.
- **Deadlock handling — [AGENT CHOICE between two acceptable strategies, must implement one for real]:**
  - (a) Maintain a wait-for graph among active transactions and run cycle detection before granting a lock that would create a wait; abort the youngest transaction in a detected cycle, or
  - (b) Use a lock-timeout (e.g. 2s) after which a waiting transaction aborts and retries.
  Strategy (a) is closer to what the Project Doc's assessment table (§8, Team A row) implies as the general expectation for deadlock handling across the system, and gives Team C a genuine, demonstrable "deadlock cases" artefact — prefer it if time allows; (b) is an acceptable fallback given the timeline.
- Lock manager must expose enough telemetry (current holders, waiters, and any detected cycle) to write the "0 duplicate applications or lost updates in 10,000 concurrent application attempts" test from the Project Doc's Team C KPI table.

## 3.9 Query Processor **[SPEC]**

No SQL parser is required or expected. Implement a small internal query interface used by services (L2) to ask the Storage Engine for data, e.g.:

```js
queryProcessor.find(table, {
  filter: { drive_id: "d-123", state: "SHORTLISTED" },
  range: { field: "created_at", gte: "2026-08-01T00:00:00Z" },
  sort: { field: "created_at", order: "desc" },
  limit: 50
})
```

Execution rule the query processor must follow: **use an index when the filter/range matches an indexed field (§3.4/§3.5); otherwise perform a full in-memory scan of the loaded table and say so in a debug/telemetry field** (e.g. `usedIndex: false`), so the "index-performance comparison" test scenario from the Project Doc has something concrete to compare against.

## 3.10 Audit and Outbox **[PROJECT DOC + SPEC]**

- `audit.jsonl`: one line per state-changing action, appended atomically as part of the same transaction that makes the change (never a separate best-effort write). Minimum fields, per the Project Doc's C4: `actor, action, before, after, correlation_id, source_service, timestamp`, plus `entity_table`, `entity_id`.
- `outbox.jsonl`: append-only feed of committed state changes that Team D's SSE/WebSocket endpoint tails to push live updates — this is the mechanism behind "Team C uses an outbox/audit record so committed state changes are not lost" (Project Doc §2). It may reuse the audit record's shape plus a `sequence` number so Team D's stream endpoint can resume from a last-seen offset after a reconnect.
- `GET /api/v1/audit` (per the Project Doc's Team C API matrix) queries this log — filterable at minimum by `correlation_id`, `entity_id`, and a time range, using the query processor (§3.9).

## 3.11 Index configuration summary **[SPEC]**

`src/config/indexConfig.js` should declare, in one place, every index the Storage Manager must build and maintain:

```js
module.exports = {
  applications: {
    hash: ["application_id", "idempotency_key"],
    bplustree: ["drive_id", "created_at"]
  },
  students: {
    hash: ["student_id"],
    bplustree: ["cgpa"]
  },
  drives: {
    hash: ["drive_id"]
  }
};
```
This is the single file an agent extends if a new query pattern needs a new index — it must not scatter ad-hoc indexing decisions across service files.
