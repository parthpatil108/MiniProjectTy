import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkCache, benchmarkRanking, benchmarkShortlistIndexes, calculateDispatchRate, compareRankingResults, createRankingBenchmarkDataset, DEFAULT_API_LOAD_OPTIONS, percentile, summarizeApiLoadRun } from '../src/services/benchmarkService';
import { RankingService } from '../src/services/rankingService';

test('benchmark dataset generation is deterministic and has the specified size', () => {
  const first = createRankingBenchmarkDataset(); const second = createRankingBenchmarkDataset();
  assert.equal(first.student_count, 1000); assert.equal(first.edge_count, 5000);
  assert.equal(second.student_count, first.student_count); assert.equal(second.edge_count, first.edge_count);
  assert.deepEqual(first.registry.getGraph(), second.registry.getGraph());
});

test('percentile uses nearest-rank values and handles empty samples', () => {
  assert.equal(percentile([], 0.95), 0);
  assert.equal(percentile([8, 1, 4, 2], 0.5), 2);
  assert.equal(percentile([8, 1, 4, 2], 0.95), 8);
  assert.throws(() => percentile([1], 2), /between 0 and 1/);
  assert.throws(() => percentile([], 2), /between 0 and 1/);
});

test('ranking comparison reports numeric score deviation and ordering mismatch', () => {
  const dataset = createRankingBenchmarkDataset(); const ranking = new RankingService(dataset.registry);
  const reference = ranking.computeRanking({ driveId: 'BENCH', algorithm: 'WEIGHTED_SCORE' });
  const matching = ranking.computeRanking({ driveId: 'BENCH', algorithm: 'HEAP_TOPK', topK: 1000 });
  assert.deepEqual(compareRankingResults(reference, matching), { reference_algorithm: 'WEIGHTED_SCORE', algorithm: 'HEAP_TOPK', max_score_deviation: 0, has_discrepancy: false, ordering_mismatch_count: 0, compared_candidates: 1000 });
  const altered = { ...matching, ordered_candidates: matching.ordered_candidates.map((candidate, i) => i === 0 ? { ...candidate, score: candidate.score + 1 } : candidate) };
  const changedScore = compareRankingResults(reference, altered);
  assert.equal(changedScore.max_score_deviation, 1); assert.equal(changedScore.has_discrepancy, true);
  const missingCandidate = { ...matching, ordered_candidates: matching.ordered_candidates.slice(1) };
  const missing = compareRankingResults(reference, missingCandidate);
  assert.equal(missing.max_score_deviation, null); assert.equal(missing.has_discrepancy, true);
  assert.doesNotMatch(JSON.stringify(missing), /"max_score_deviation":null,"has_discrepancy":false/);
});

test('ranking benchmark accepts a configurable HEAP_TOPK shortlist size while retaining full-result comparisons', () => {
  const result = benchmarkRanking(1, 10);
  assert.equal(result.full_result_top_k, 1000);
  assert.equal(result.heap_top_k_shortlist.top_k, 10);
  assert.equal(result.heap_top_k_shortlist.returned_candidate_count, 10);
  assert.equal(result.optimality.length, 2);
});

test('Hash and AVL benchmarks report matching counts for the same lookup workload', () => {
  const result = benchmarkShortlistIndexes(20, 100);
  assert.equal(result.hash.lookup_count, 100); assert.equal(result.avl.lookup_count, 100);
  assert.equal(result.hash.successful_lookups, 80); assert.equal(result.avl.successful_lookups, 80);
  assert.equal(result.hash.failed_lookups, 20); assert.equal(result.avl.failed_lookups, 20);
  assert.equal(result.hash.structural_evidence.map_entries, 20);
  assert.equal(result.avl.structural_evidence.avl_nodes, 20);
});

test('API load helpers calculate actual dispatch rate and response success/failure counts', () => {
  assert.deepEqual(DEFAULT_API_LOAD_OPTIONS, { totalRequests: 400, targetRequestsPerSecond: 200, warmupRequests: 20, measuredRuns: 3 });
  assert.equal(calculateDispatchRate([100, 105, 110, 115]), 200);
  const result = summarizeApiLoadRun(200, 4, [100, 105, 110, 115], [
    { success: true, response_received: true, latency_ms: 2, completed_at_ms: 102 },
    { success: true, response_received: true, latency_ms: 3, completed_at_ms: 108 },
    { success: false, response_received: true, latency_ms: 4, completed_at_ms: 120 },
    { success: false, response_received: false, latency_ms: 5, completed_at_ms: 125 },
  ]);
  assert.equal(result.target_requests_per_second, 200);
  assert.equal(result.scheduled_requests, 4); assert.equal(result.dispatched_requests, 4);
  assert.equal(result.dispatch_rate, 200);
  assert.equal(result.successful_requests, 2); assert.equal(result.failed_requests, 2);
  assert.equal(result.failure_percentage, 50);
  assert.equal(result.response_throughput, 150);
  assert.equal(result.latency_ms.p50_ms, 3);
});

test('cache benchmark reports actual hit rate and invalidation timing samples', () => {
  const result = benchmarkCache(20, 3);
  assert.equal(result.total_requests, 20); assert.equal(result.cache_hits, 18); assert.equal(result.cache_misses, 2);
  assert.equal(result.hit_rate, 0.9); assert.equal(result.invalidation_count, 3);
  assert.ok(result.invalidation_timing_ms.min_ms >= 0);
  assert.ok(result.invalidation_timing_ms.p95_ms >= 0);
});
