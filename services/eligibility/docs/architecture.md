# Team A — Eligibility Rule Engine: Architectural Specification

## 1. Executive Summary & Boundary

Team A owns the **Eligibility Rule Engine** for the Campus Placement Platform. Aligned with the academic Operating Systems theme, Team A implements algorithmic queue scheduling, deterministic rule evaluations, starvation prevention via priority aging, and real-time telemetry streaming.

### Scope Demarcation
- **Authoritative Data**: Team C is the authoritative system of record. Team A maintains in-memory working state and does not persist authoritative database tables.
- **Scope Restriction**: In accordance with system requirements, this engine specifically executes student academic eligibility screening, rule-chaining, queue intake, and performance analytics.

---

## 2. Core Architecture & Components

```
                +----------------------------------------------------+
                |               Team A Express API Server           |
                +----------------------------------------------------+
                                      |
       +------------------------------+------------------------------+
       |                              |                              |
       v                              v                              v
+------------------+       +---------------------+       +----------------------+
|  Queue Manager   |       |  Rule Evaluator     |       |  Telemetry & SSE     |
+------------------+       +---------------------+       +----------------------+
| - FIFO           |       | - Sequential AND    |       | - MetricsCollector   |
| - Circular Ring  |       | - Weighted-Priority |       | - EventStream (SSE)  |
| - Priority Aging |       | - Decision-Tree     |       | - Latency Percentiles|
| - Binary Heap    |       +---------------------+       +----------------------+
+------------------+
```

### 2.1 Queue Algorithms & Scheduling Policies

Team A implements four concrete queue data structures:
1. **FIFO Queue (`FifoQueue`)**: First-In First-Out order for standard batch processing.
2. **Circular Queue (`CircularQueue`)**: Fixed-capacity ring buffer using modular pointer arithmetic (`(tail + 1) % capacity`) to simulate bounded hardware queues.
3. **Priority Queue (`PriorityQueue`) with Dynamic Aging**:
   - Manages multi-tiered applicant priorities (`HIGH` vs `NORMAL`).
   - Implements **dynamic aging** to prevent priority starvation:
     $$\text{Effective Priority} = \text{Base Priority} + \left\lfloor \frac{\text{Wait Time}}{\text{Aging Interval}} \right\rfloor \times \text{Aging Boost}$$
   - Under continuous high-priority traffic, waiting normal-priority items increase in score until they surpass incoming high-priority items, guaranteeing starvation freedom.
4. **Binary Heap Queue (`BinaryHeapQueue`)**: Max-heap implementation with \(O(\log n)\) insertions and extractions.

### 2.2 Pluggable Rule-Chaining Strategies

1. **Sequential AND-Chain (`SequentialAndStrategy`)**:
   - Sequential validation across CGPA, backlogs, branch, attendance, and skill tags.
   - Fail-fast or full-failure cataloging.
2. **Weighted-Priority Chain (`WeightedPriorityStrategy`)**:
   - Assigns explicit weight distributions (CGPA 30%, backlogs 25%, branch 20%, attendance 15%, skills 10%).
   - Supports `CONDITIONAL` eligibility status when academic core passes but secondary thresholds are borderline.
3. **Decision-Tree Chain (`DecisionTreeStrategy`)**:
   - Multi-branch decision tree separating core engineering branches from allied branches.
   - Evaluates conditional waiver paths (such as exceptional CGPA compensating for a single backlog).

---

## 3. Cross-Team Contracts & Error Semantics

- **Envelope Compliance**: All responses strictly follow `{ data: {...}, meta: { correlation_id, api_version: "v1", timestamp } }`.
- **Error Codes**: All faults use the closed error code vocabulary: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `IDEMPOTENCY_CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).
- **Idempotency**: 24-hour cache retention per `Idempotency-Key` and atomic deduplication by `request_id`.
