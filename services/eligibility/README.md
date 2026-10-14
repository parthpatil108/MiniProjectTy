# Team A — Eligibility Rule Engine

Operating Systems Engine for the Rule-Based Placement Eligibility and Performance Analytics Platform.

This engine is built entirely in **TypeScript** on **Node.js / Express**, adhering strictly to the shared API envelopes, idempotency semantics, error registries, and data models defined in `docs/` and `shared/contracts/`.

---

## 1. Capabilities & Core Modules

### 1.1 Queue Management (`src/queue/`)
Team A implements four concrete algorithmic queue variants for managing incoming student eligibility evaluations:
- **FIFO Queue (`FifoQueue`)**: First-In, First-Out queue for standard sequential processing.
- **Circular Queue (`CircularQueue`)**: Fixed-capacity ring buffer with wrap-around pointers simulating bounded memory buffers.
- **Priority Queue with Dynamic Aging (`PriorityQueue`)**: Prioritizes `HIGH` over `NORMAL` priority applications while continuously incrementing the effective priority score of waiting requests to eliminate starvation.
- **Binary Heap Queue (`BinaryHeapQueue`)**: Binary max-heap priority queue with \(O(\log n)\) insertion and extraction.
- **Queue Manager (`QueueManager`)**: Isolates queues per placement drive, supports live policy switching, and calculates estimated evaluation times.

### 1.2 Pluggable Rule Chaining Strategies (`src/rules/`)
Evaluates student academic records against placement drive requirements across multiple algorithmic approaches:
- **Sequential AND-Chain (`SequentialAndStrategy`)**: Fast sequential evaluation verifying CGPA cutoff, backlog limits, allowed branches, attendance thresholds, and skill tags.
- **Weighted-Priority Chain (`WeightedPriorityStrategy`)**: Weighted scoring distribution (CGPA 30%, backlogs 25%, branch 20%, attendance 15%, skills 10%). Supports `CONDITIONAL` eligibility when core criteria pass but secondary attributes are borderline.
- **Decision-Tree Chain (`DecisionTreeStrategy`)**: Multi-branch decision tree differentiating core engineering branches from allied branches, with compensatory waiver paths for exceptional academic merit.

### 1.3 Telemetry & Live Streaming (`src/telemetry/`)
- **Metrics Collector (`MetricsCollector`)**: Computes running p95 evaluation latency, throughput per second, wait times by priority class, active queue depth, and starvation counts.
- **Server-Sent Events (`EventStream`)**: Provides a live SSE stream (`GET /api/v1/stream/eligibility`) emitting real-time state transitions (`REQUEST_ENQUEUED`, `EVALUATION_COMPLETED`).

---

## 2. API Endpoints

All responses conform to the standard success/error envelope:
```json
{
  "data": { ... },
  "meta": {
    "correlation_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "api_version": "v1",
    "timestamp": "2026-09-04T10:00:00.000Z"
  }
}
```

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint returning service status. |
| `POST` | `/api/v1/eligibility/requests` | Enqueue an eligibility request (idempotent via `request_id` and `Idempotency-Key`). Returns `202 Accepted`. |
| `GET` | `/api/v1/drives/:driveId/queue` | Retrieve the ordered queue and estimated evaluation times for a drive. |
| `GET` | `/api/v1/eligibility/requests/:requestId` | Inspect request lifecycle state and decision result. |
| `GET` | `/api/v1/eligibility/decisions/:decisionId` | Read decision details by decision ID. |
| `POST` | `/internal/v1/rules/evaluate` | Directly execute a configured rule chaining strategy on a student profile. |
| `GET` | `/api/v1/metrics/eligibility` | Read algorithm performance metrics (p95 latency, queue depth, throughput). |
| `GET` | `/api/v1/stream/eligibility` | Server-Sent Events (SSE) live event stream. |

---

## 3. Development & Testing

### Installation
```bash
cd team-a
npm install
```

### Build & Run
```bash
# Compile TypeScript to dist/
npm run build

# Start production server
npm start

# Run in development mode with live reload
npm run dev
```

### Test Suites
```bash
# Run all 35 tests (unit, contract, and KPI benchmarks)
npm test

# Run unit tests only
npm run test:unit

# Run contract tests only (OpenAPI 3.x conformance)
npm run test:contract

# Run KPI benchmark suite
npm run test:kpi
```

---

## 4. Acceptance KPIs & Benchmark Evidence

The benchmark suite verifies the engine against the project KPIs:
- **Rule-Evaluation Correctness**: **100%** match with reference decisions across agreed test suites.
- **Decision Latency**: **p95 < 1 ms** for 1,000 queued requests (Target: \(\le 200\text{ ms}\)).
- **Fairness & Starvation Freedom**: **0 starvation** occurrences with dynamic priority aging.
- **Telemetry Completeness**: **100%** state transitions carry `request_id`, `timestamp`, `rule_set_version`, and `correlation_id`.

Generated evidence artifact: [`docs/benchmark-report.json`](file:///team-a/docs/benchmark-report.json).
