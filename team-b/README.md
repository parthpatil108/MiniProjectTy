# Team B — Ranking & Analytics Engine

Team B owns its in-memory candidate graph, eligibility/ranking (B1/B2), shortlist retrieval (B3), and historical placement aggregation (B4). Team C remains the authoritative application and placement state store; Team B consumes supplied API data and does not access Team C's database.

## B3: shortlist lookup

On replacement, B3 removes candidate keys no longer present and refreshes each retained or added entry with its new rank, score, and profile version. Matching cache invalidation removes that shortlist's index entries; entries for other shortlists remain. Every cache read now requires an expected profile version.

B3 indexes B2's existing ordered shortlist output; it does not rank candidates. Entries retain the B2 fields `student_id`, `rank`, and `score`. The lookup `key` is a candidate index key formed as URL-encoded `shortlist_key::student_id`; this lets a student appear in multiple shortlists without overwriting another index entry. Index entries point to their shortlist cache key. The response's `cached_shortlist` object contains an `entries` array of ordered B2 entries. `index_statistics` reports entry, lookup, hit, and miss counts. Profile-version mismatch and expiry remove or refuse the stale cache value. Invalidation is conditional on an exact `profile_version`, so a request for an older version cannot delete a newer entry. Hash map lookup is average O(1), not guaranteed O(1); AVL search/insert/delete are O(log n). Both index implementations are in-memory processing representations.

The API server in `src/api/server.ts` binds these operations to HTTP routes and uses the shared `{data, meta}` / `{error, meta}` envelope. The metrics route reports observed cache hit rate and index lookup p95. Ranking computation latency is measured by the reproducible benchmark command below.

## B4: historical placement analytics

Under the current MVP buckets, **zero LPA is valid** and belongs to `[0,3)`. Changing that rule would move zero-valued placed records to `missing_or_invalid` and requires an explicit decision. The service adapters validate invalidation body field types, analytics filter types, and supplied UUID v4 correlation IDs; invalid analytics filters and correlation IDs raise `TypeError` for the host HTTP layer to map. The host must still enforce required headers and HTTP status mapping.

The MVP record is `{student_id, department, batch, company, stage, package_lpa?}` with stage `Applied | Eligible | Shortlisted | Placed`. The company/student pair is the deduplication key because placement cycle is not a field. Duplicate rows keep the most advanced explicitly observed stage; duplicate placed rows use the lowest valid package so a repeated record cannot inflate a count. Filters are applied before deduplication and aggregation. Conflicting department/batch values within duplicates should be corrected at the input source; cycle-level distinctions cannot be expressed by this model.

`department_trend` is an object keyed by URL-encoded `department::batch` and groups by department and batch. Its rate is distinct placed students / distinct represented students in that cohort × 100. `conversion_rate` pools company applications after filtering: distinct placed student-company pairs / distinct applied student-company pairs × 100; any valid stage represents an application. A student applying to two companies contributes two company applications. Package ranges are `[0,3)`, `[3,6)`, `[6,10)`, and `[10,+∞)` LPA. Missing, negative, NaN, or infinite packages on placed records are counted in `missing_or_invalid`, never coerced to zero. Only placed rows contribute to package buckets.

Aggregation takes O(n + c log c): one pass over n records plus sorting c distinct cohorts for stable output. Analytics are historical summaries only and do not perform current candidate ranking. Runtime benchmarks are reported separately from placement metrics.

## Reproducible benchmarks

Run `npm run benchmark` to execute the ranking, shortlist index, cache, invalidation, and local ranking API load benchmarks. The command builds the TypeScript project and runs `src/demo/benchmarkDemo.ts`.

The ranking benchmark generates 1,000 deterministic student profiles and a graph with 5,000 edges, warms each supported algorithm, then reports per-algorithm p50/p95/p99, min, max, and mean elapsed milliseconds over the requested repetitions. Full-result comparisons use K=1,000 for all algorithms. A separate configurable HEAP_TOPK workload defaults to K=10 and reports its K, result count, and timing distribution. It compares full-result MERGE_SORT and HEAP_TOPK scores and ordering with WEIGHTED_SCORE, reporting score deviation, candidate discrepancy, and ordering mismatches. If candidates are missing, `max_score_deviation` is `null` and `has_discrepancy` is true; JSON does not silently convert infinity to null. The reference here is the WEIGHTED_SCORE output from the same implementation; this is an in-project consistency check, not an independent external oracle.

The Hash/AVL benchmark runs the existing `ShortlistIndex` implementations over 10,000 entries and 20,000 deterministic hit/miss lookups. It reports total, average, p50, and p95 lookup timings. Structural counts describe logical Map entries and AVL nodes, not RAM usage; each current `ShortlistIndex` instance maintains both structures. Expected lookup complexity is average O(1) for Map and O(log n) for AVL.

The cache benchmark performs repeated reads of a computed shortlist with a deterministic 90% intended hit pattern and measures actual hit/miss counts, then measures individual invalidation durations. A hit rate of 90% applies only to this deterministic benchmark workload, not production traffic.

The API benchmark performs 20 warm-up requests, then 3 measured runs of 400 requests each, scheduled toward 200 requests per second on an in-process HTTP server using the actual ranking route. Each run reports the target rate, scheduled and dispatched counts, client dispatch rate calculated from actual dispatch timestamps over the first-to-last dispatch interval, response success/failure percentage, response throughput (received HTTP responses per second from first dispatch to last received response), and latency p50/p95/p99. The dispatch and response windows exclude server startup and shutdown. Response drain is included in response throughput but not dispatch rate. Dispatch rate is inter-dispatch rate; scheduling delays can produce a lower observed rate or request bunching, which is not separately histogrammed. Local API load testing does not establish production capacity. Results vary by machine and runtime; the command does not guarantee any KPI target. These wall-clock measurements are distinct from theoretical complexity and structural storage evidence.

Scripts: `npm test`, `npm run typecheck`, `npm run build`, `npm run demo:b1` through `npm run demo:b4`, and `npm run benchmark`.
