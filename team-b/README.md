# Team B — Ranking & Shortlisting Analytics Engine

Data Structures Engine for the ApniLeap campus placement platform.

## Responsibilities
- **Graph & Profile Registry (B1):** Dual graph representations (Adjacency List baseline and Adjacency Matrix) modeling the student-skill-drive bipartite relationships.
- **Ranking Computation (B2):** Multi-algorithm candidate ranking (`WEIGHTED_SCORE`, `HEAP_TOPK`, `MERGE_SORT`) with deterministic tie-breaking (Score -> CGPA -> Student ID).
- **Fast Lookup Index (B3):** Dual index implementation (Hash map and self-balancing AVL Tree) with TTL/LRU caching protecting against stale `graph_version`.
- **Performance Analytics (B4):** Cohort analysis, company-wise conversion rate deduplication, and salary package bucket distributions.

## Running the Service
- **Default Port:** `3002`
- **Start Service:** `npm run dev` or `node dist/src/server.js`
- **Run Tests:** `npm test` (Runs build + 31 unit, ranking, and contract tests)
- **Health Check:** `GET http://localhost:3002/healthz`
