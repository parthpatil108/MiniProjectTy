import { AvlTree } from './avlTree';
import type { RankedCandidate } from '../types';
import { analysePlacements } from './analyticsService';
import type { HistoricalPlacementRecord } from '../types';
import { ProfileRegistryService } from './profileRegistryService';
import { RankingService } from './rankingService';
import type { Drive, RankingAlgorithm, RankingResult, Student } from '../types';
import { ShortlistIndex, entryFromCandidate } from './shortlistIndexService';
import { ShortlistCacheService } from './shortlistCacheService';
import { createServer } from 'node:http';
import { handleRequest } from '../api/router';
import { ShortlistLookupService } from './shortlistLookupService';
import { AnalyticsService } from './analyticsService';
import { RankingMetricsService } from './rankingMetricsService';

export function percentile(values: number[], p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('p must be between 0 and 1.');
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

function durationSummary(values: number[]) {
  return { min_ms: values.length ? Math.min(...values) : 0, p50_ms: percentile(values, 0.5), p95_ms: percentile(values, 0.95), p99_ms: percentile(values, 0.99), max_ms: values.length ? Math.max(...values) : 0, average_ms: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 };
}

export interface RankingComparison { reference_algorithm: RankingAlgorithm; algorithm: RankingAlgorithm; max_score_deviation: number | null; has_discrepancy: boolean; ordering_mismatch_count: number; compared_candidates: number }
export function compareRankingResults(reference: RankingResult, actual: RankingResult): RankingComparison {
  const referenceScores = new Map(reference.ordered_candidates.map((candidate) => [candidate.student_id, candidate.score]));
  const actualScores = new Map(actual.ordered_candidates.map((candidate) => [candidate.student_id, candidate.score]));
  const ids = new Set([...referenceScores.keys(), ...actualScores.keys()]);
  let max_score_deviation = 0; let hasMissingCandidate = false;
  for (const id of ids) {
    const left = referenceScores.get(id); const right = actualScores.get(id);
    if (left === undefined || right === undefined) hasMissingCandidate = true;
    else max_score_deviation = Math.max(max_score_deviation, Math.abs(left - right));
  }
  const length = Math.max(reference.ordered_candidates.length, actual.ordered_candidates.length);
  let ordering_mismatch_count = 0;
  for (let i = 0; i < length; i++) if (reference.ordered_candidates[i]?.student_id !== actual.ordered_candidates[i]?.student_id) ordering_mismatch_count++;
  const has_discrepancy = hasMissingCandidate || max_score_deviation !== 0 || ordering_mismatch_count !== 0;
  return { reference_algorithm: reference.algorithm, algorithm: actual.algorithm, max_score_deviation: hasMissingCandidate ? null : max_score_deviation, has_discrepancy, ordering_mismatch_count, compared_candidates: ids.size };
}

export function createRankingBenchmarkDataset(): { registry: ProfileRegistryService; student_count: number; edge_count: number } {
  const registry = new ProfileRegistryService();
  const required = ['Skill0', 'Skill1', 'Skill2', 'Skill3'];
  for (let i = 0; i < 1000; i++) {
    const skills = i < 996 ? [...required, 'Skill4'] : [...required];
    const student: Student = { student_id: `S${String(i).padStart(4, '0')}`, name: `Student ${i}`, branch: 'CSE', cgpa: 6 + (i % 41) / 10, backlogs: 0, attendance: 75 + (i % 26), project_score: 50 + (i % 51), skill_tags: skills };
    registry.addOrUpdateStudent(student);
  }
  const drive: Drive = { drive_id: 'BENCH', company: 'Benchmark', criteria: { min_cgpa: 6, max_backlogs: 0, allowed_branches: ['CSE'], min_attendance: 75, required_skill_tags: required }, skill_weightage: { Skill0: 25, Skill1: 25, Skill2: 25, Skill3: 25 }, seats: 1000, package: '0', state: 'OPEN', version: 1 };
  registry.addOrUpdateDrive(drive);
  const graph = registry.getGraph();
  return { registry, student_count: registry.students.size, edge_count: Object.values(graph).reduce((sum, neighbors) => sum + neighbors.length, 0) / 2 };
}

export interface RankingBenchmark { student_count: number; graph_edge_count: number; repetitions: number; timings: Record<RankingAlgorithm, ReturnType<typeof durationSummary>>; full_result_top_k: number; heap_top_k_shortlist: { top_k: number; returned_candidate_count: number; timings: ReturnType<typeof durationSummary> }; optimality: RankingComparison[] }
export function benchmarkRanking(repetitions = 20, shortlistTopK = 10): RankingBenchmark {
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new RangeError('repetitions must be a positive integer.');
  if (!Number.isInteger(shortlistTopK) || shortlistTopK < 1 || shortlistTopK > 1000) throw new RangeError('shortlistTopK must be between 1 and 1000.');
  const dataset = createRankingBenchmarkDataset(); const service = new RankingService(dataset.registry);
  const algorithms: RankingAlgorithm[] = ['WEIGHTED_SCORE', 'MERGE_SORT', 'HEAP_TOPK'];
  for (const algorithm of algorithms) service.computeRanking({ driveId: 'BENCH', algorithm, topK: 1000 });
  const samples = Object.fromEntries(algorithms.map((algorithm) => [algorithm, [] as number[]])) as Record<RankingAlgorithm, number[]>;
  const results = new Map<RankingAlgorithm, RankingResult>();
  for (const algorithm of algorithms) {
    for (let i = 0; i < repetitions; i++) {
      const start = process.hrtime.bigint();
      results.set(algorithm, service.computeRanking({ driveId: 'BENCH', algorithm, topK: 1000 }));
      samples[algorithm].push(Number(process.hrtime.bigint() - start) / 1_000_000);
    }
  }
  const reference = results.get('WEIGHTED_SCORE')!;
  const shortlistSamples: number[] = []; let shortlistResult: RankingResult | undefined;
  service.computeRanking({ driveId: 'BENCH', algorithm: 'HEAP_TOPK', topK: shortlistTopK });
  for (let i = 0; i < repetitions; i++) {
    const start = process.hrtime.bigint();
    shortlistResult = service.computeRanking({ driveId: 'BENCH', algorithm: 'HEAP_TOPK', topK: shortlistTopK });
    shortlistSamples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  return { student_count: dataset.student_count, graph_edge_count: dataset.edge_count, repetitions, timings: Object.fromEntries(algorithms.map((algorithm) => [algorithm, durationSummary(samples[algorithm])])) as RankingBenchmark['timings'], full_result_top_k: 1000, heap_top_k_shortlist: { top_k: shortlistTopK, returned_candidate_count: shortlistResult?.ordered_candidates.length ?? 0, timings: durationSummary(shortlistSamples) }, optimality: algorithms.slice(1).map((algorithm) => compareRankingResults(reference, results.get(algorithm)!)) };
}

export interface IndexKindBenchmark { dataset_size: number; lookup_count: number; successful_lookups: number; failed_lookups: number; total_ms: number; average_lookup_us: number; p50_lookup_us: number; p95_lookup_us: number; structural_evidence: { map_entries: number; avl_nodes: number; interpretation: string; expected_lookup_complexity: string } }
export function benchmarkShortlistIndexes(datasetSize = 10_000, lookupCount = 20_000): { hash: IndexKindBenchmark; avl: IndexKindBenchmark } {
  if (!Number.isInteger(datasetSize) || datasetSize < 1 || !Number.isInteger(lookupCount) || lookupCount < 1) throw new RangeError('datasetSize and lookupCount must be positive integers.');
  const output = {} as Record<'hash' | 'avl', IndexKindBenchmark>;
  for (const kind of ['hash', 'avl'] as const) {
    const index = new ShortlistIndex(kind);
    for (let i = 0; i < datasetSize; i++) {
      const candidate = { student_id: `S${String(i).padStart(8, '0')}`, rank: i + 1, score: 100 - i % 100 };
      index.set(candidate.student_id, entryFromCandidate(candidate, 'benchmark', 'v1'));
    }
    let successful_lookups = 0; const durations: number[] = [];
    const start = process.hrtime.bigint();
    for (let i = 0; i < lookupCount; i++) {
      const key = i % 5 === 0 ? `missing-${i}` : `S${String((i * 7919) % datasetSize).padStart(8, '0')}`;
      const result = index.get(key); if (result.entry) successful_lookups++;
      durations.push(result.lookup_time_us);
    }
    const total_ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    output[kind] = { dataset_size: datasetSize, lookup_count: lookupCount, successful_lookups, failed_lookups: lookupCount - successful_lookups, total_ms, average_lookup_us: durations.reduce((sum, duration) => sum + duration, 0) / lookupCount, p50_lookup_us: percentile(durations, 0.5), p95_lookup_us: percentile(durations, 0.95), structural_evidence: { map_entries: index.size, avl_nodes: index.size, interpretation: 'Each ShortlistIndex instance currently maintains both a Map and an AVL tree; these are logical entry counts, not measured RAM.', expected_lookup_complexity: kind === 'hash' ? 'Map average O(1)' : 'AVL O(log n)' } };
  }
  return output;
}

export interface CacheBenchmark { total_requests: number; cache_hits: number; cache_misses: number; hit_rate: number; invalidation_count: number; invalidation_timing_ms: ReturnType<typeof durationSummary> }
export function benchmarkCache(requestCount = 1000, invalidationCount = 100): CacheBenchmark {
  if (!Number.isInteger(requestCount) || requestCount < 1 || !Number.isInteger(invalidationCount) || invalidationCount < 1) throw new RangeError('requestCount and invalidationCount must be positive integers.');
  const dataset = createRankingBenchmarkDataset();
  const shortlist = new RankingService(dataset.registry).computeRanking({ driveId: 'BENCH', algorithm: 'WEIGHTED_SCORE' }).ordered_candidates;
  const cache = new ShortlistCacheService(); cache.set('hot', shortlist, dataset.registry.graph_version, 60_000);
  for (let i = 0; i < requestCount; i++) cache.get(i % 10 === 9 ? `missing-${i}` : 'hot', dataset.registry.graph_version);
  const { cache_hits, cache_misses } = cache.statistics();
  const invalidationDurations: number[] = [];
  for (let i = 0; i < invalidationCount; i++) {
    const key = `invalidate-${i}`; cache.set(key, [], 'v1', 60_000);
    const start = process.hrtime.bigint(); cache.invalidate(key, 'v1');
    invalidationDurations.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  const attempts = cache_hits + cache_misses;
  return { total_requests: attempts, cache_hits, cache_misses, hit_rate: attempts ? cache_hits / attempts : 0, invalidation_count: invalidationDurations.length, invalidation_timing_ms: durationSummary(invalidationDurations) };
}

export interface ApiResponseSample { success: boolean; response_received: boolean; latency_ms: number; completed_at_ms: number }
export interface ApiLoadRun { target_requests_per_second: number; scheduled_requests: number; dispatched_requests: number; dispatch_rate: number; successful_requests: number; failed_requests: number; failure_percentage: number; response_throughput: number; latency_ms: ReturnType<typeof durationSummary> }
export interface ApiLoadBenchmark { warmup_requests: number; measured_runs: number; runs: ApiLoadRun[] }
export interface ApiLoadOptions { totalRequests?: number; targetRequestsPerSecond?: number; warmupRequests?: number; measuredRuns?: number }
export const DEFAULT_API_LOAD_OPTIONS: Required<ApiLoadOptions> = Object.freeze({ totalRequests: 400, targetRequestsPerSecond: 200, warmupRequests: 20, measuredRuns: 3 });

export function calculateDispatchRate(dispatchTimestamps: number[]): number {
  if (dispatchTimestamps.length < 2) return 0;
  const first = Math.min(...dispatchTimestamps); const last = Math.max(...dispatchTimestamps);
  return last > first ? ((dispatchTimestamps.length - 1) * 1000) / (last - first) : 0;
}

export function summarizeApiLoadRun(targetRequestsPerSecond: number, scheduledRequests: number, dispatchTimestamps: number[], responses: ApiResponseSample[]): ApiLoadRun {
  const successful_requests = responses.filter((response) => response.success).length;
  const dispatched_requests = dispatchTimestamps.length;
  const failed_requests = Math.max(0, dispatched_requests - successful_requests);
  const firstDispatch = dispatchTimestamps.length ? Math.min(...dispatchTimestamps) : undefined;
  const receivedResponses = responses.filter((response) => response.response_received);
  const lastCompletion = receivedResponses.length ? Math.max(...receivedResponses.map((response) => response.completed_at_ms)) : undefined;
  const responseWindowSeconds = firstDispatch !== undefined && lastCompletion !== undefined ? (lastCompletion - firstDispatch) / 1000 : 0;
  return {
    target_requests_per_second: targetRequestsPerSecond,
    scheduled_requests: scheduledRequests,
    dispatched_requests,
    dispatch_rate: calculateDispatchRate(dispatchTimestamps),
    successful_requests,
    failed_requests,
    failure_percentage: dispatched_requests ? (failed_requests * 100) / dispatched_requests : 0,
    response_throughput: responseWindowSeconds > 0 ? receivedResponses.length / responseWindowSeconds : 0,
    latency_ms: durationSummary(responses.map((response) => response.latency_ms)),
  };
}

export async function benchmarkRankingApiLoad(options: ApiLoadOptions = {}): Promise<ApiLoadBenchmark> {
  const { totalRequests, targetRequestsPerSecond, warmupRequests, measuredRuns } = { ...DEFAULT_API_LOAD_OPTIONS, ...options };
  if (!Number.isInteger(totalRequests) || totalRequests < 2 || !Number.isFinite(targetRequestsPerSecond) || targetRequestsPerSecond <= 0 || !Number.isInteger(warmupRequests) || warmupRequests < 0 || !Number.isInteger(measuredRuns) || measuredRuns < 1) throw new RangeError('Request counts and target rate must be valid positive values (warmupRequests may be zero).');
  const { registry } = createRankingBenchmarkDataset(); const ranking = new RankingService(registry); const index = new ShortlistIndex('hash'); const cache = new ShortlistCacheService();
  const context = { registry, ranking, lookup: new ShortlistLookupService(index, cache, () => registry.graph_version), analytics: new AnalyticsService([]), metrics: new RankingMetricsService(index, cache) };
  const server = createServer((req, res) => { void handleRequest(req, res, context); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine benchmark server address.');
  const url = `http://127.0.0.1:${address.port}/api/v1/rankings/compute`;
  const executeScheduledRequests = async (count: number, collect: boolean): Promise<{ dispatches: number[]; responses: ApiResponseSample[] }> => {
    const scheduleStart = performance.now(); const dispatches: number[] = []; const responses: ApiResponseSample[] = [];
    const tasks = Array.from({ length: count }, (_, i) => (async () => {
      const scheduledAt = scheduleStart + (i * 1000) / targetRequestsPerSecond;
      const delay = scheduledAt - performance.now(); if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const dispatchedAt = performance.now(); dispatches.push(dispatchedAt);
      const requestStart = performance.now();
      try {
        const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'BENCH', algorithm: 'WEIGHTED_SCORE' }) });
        await response.arrayBuffer();
        if (collect) responses.push({ success: response.ok, response_received: true, latency_ms: performance.now() - requestStart, completed_at_ms: performance.now() });
      } catch {
        if (collect) responses.push({ success: false, response_received: false, latency_ms: performance.now() - requestStart, completed_at_ms: performance.now() });
      }
    })());
    await Promise.all(tasks);
    return { dispatches, responses };
  };

  try {
    if (warmupRequests > 0) await executeScheduledRequests(warmupRequests, false);
    const runs: ApiLoadRun[] = [];
    for (let run = 0; run < measuredRuns; run++) {
      const measured = await executeScheduledRequests(totalRequests, true);
      runs.push(summarizeApiLoadRun(targetRequestsPerSecond, totalRequests, measured.dispatches, measured.responses));
    }
    return { warmup_requests: warmupRequests, measured_runs: measuredRuns, runs };
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

export interface LookupBenchmark { dataset_size: number; lookup_count: number; successful_lookups: number; unsuccessful_lookups: number; hash_total_us: number; avl_total_us: number; hash_mean_us: number; avl_mean_us: number }
export function benchmarkIndexes(datasetSize = 10_000, lookupCount = 20_000): LookupBenchmark {
  const hash = new Map<string, RankedCandidate>(); const avl = new AvlTree<RankedCandidate>();
  for (let i = 0; i < datasetSize; i++) { const key = `student-${String(i).padStart(8, '0')}`; const value = { student_id: key, rank: i + 1, score: 100 - (i % 100) }; hash.set(key, value); avl.set(key, value); }
  const keys = Array.from({ length: lookupCount }, (_, i) => i % 5 === 0 ? `missing-${i}` : `student-${String((i * 7919) % datasetSize).padStart(8, '0')}`);
  const time = (lookup: (key: string) => unknown) => { const start = process.hrtime.bigint(); for (const key of keys) lookup(key); return Number(process.hrtime.bigint() - start) / 1_000; };
  const hash_total_us = time((key) => hash.get(key)); const avl_total_us = time((key) => avl.get(key));
  return { dataset_size: datasetSize, lookup_count: lookupCount, successful_lookups: keys.filter((k) => !k.startsWith('missing-')).length, unsuccessful_lookups: keys.filter((k) => k.startsWith('missing-')).length, hash_total_us, avl_total_us, hash_mean_us: lookupCount ? hash_total_us / lookupCount : 0, avl_mean_us: lookupCount ? avl_total_us / lookupCount : 0 };
}

export function benchmarkAnalytics(recordCount = 20_000): { record_count: number; cohort_count: number; duration_ms: number; complexity: string } {
  const records: HistoricalPlacementRecord[] = Array.from({ length: recordCount }, (_, i) => ({
    student_id: `S${i}`, department: `D${i % 12}`, batch: `${2020 + i % 6}`, company: `C${i % 200}`,
    stage: i % 4 === 0 ? 'Placed' : i % 3 === 0 ? 'Shortlisted' : 'Applied', ...(i % 4 === 0 ? { package_lpa: 3 + (i % 17) } : {}),
  }));
  const start = process.hrtime.bigint(); const result = analysePlacements(records); const duration_ms = Number(process.hrtime.bigint() - start) / 1_000_000;
  return { record_count: recordCount, cohort_count: Object.keys(result.department_trend).length, duration_ms, complexity: 'O(n + c log c), where n is records and c is distinct department/batch cohorts' };
}
