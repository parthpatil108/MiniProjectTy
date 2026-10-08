import assert from 'node:assert/strict';
import test from 'node:test';
import { dummyDrives, dummyStudents } from '../src/data/dummyProfiles';
import { calculateWeightedScore } from '../src/ranking/weightedScore';
import { mergeSortCandidates } from '../src/ranking/mergeSort';
import { evaluateStudentEligibility } from '../src/services/eligibilityService';
import { ProfileRegistryService } from '../src/services/profileRegistryService';
import { createShortlist, RankingService } from '../src/services/rankingService';
import { createServer } from 'node:http';
import { handleRequest } from '../src/api/router';
import { ShortlistIndex } from '../src/services/shortlistIndexService';
import { ShortlistCacheService } from '../src/services/shortlistCacheService';
import { ShortlistLookupService } from '../src/services/shortlistLookupService';
import { AnalyticsService } from '../src/services/analyticsService';
import { RankingMetricsService } from '../src/services/rankingMetricsService';

function createRegistry(): ProfileRegistryService { const registry = new ProfileRegistryService(); for (const student of dummyStudents) registry.addOrUpdateStudent(student); for (const drive of dummyDrives) registry.addOrUpdateDrive(drive); return registry; }

test('B2 evaluates eligibility using existing drive criteria', () => {
  const drive = dummyDrives[0];
  assert.deepEqual(evaluateStudentEligibility(dummyStudents[0], drive), { student_id: 'S001', status: 'ELIGIBLE', reasons: [] });
  assert.equal(evaluateStudentEligibility(dummyStudents[1], drive).status, 'NOT_ELIGIBLE');
  assert.match(evaluateStudentEligibility(dummyStudents[1], drive).reasons[0], /Missing required skill/);
  assert.deepEqual(evaluateStudentEligibility({ ...dummyStudents[0], cgpa: 6.9 }, drive).reasons, ['CGPA below cutoff']);
  assert.deepEqual(evaluateStudentEligibility({ ...dummyStudents[0], backlogs: 2 }, drive).reasons, ['Backlog restriction']);
});
test('B2 ranks eligible candidates by weighted score with a deterministic tie-break', () => {
  const service = new RankingService(createRegistry());
  const result = service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' });
  assert.deepEqual(result.ordered_candidates.map((candidate) => candidate.student_id), ['S004', 'S001', 'S003']);
  assert.equal(result.ranking_id, service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' }).ranking_id);
  assert.deepEqual(mergeSortCandidates([{ student_id: 'S011', score: 90, cgpa: 8.5 }, { student_id: 'S010', score: 90, cgpa: 8.5 }, { student_id: 'S012', score: 90, cgpa: 8.8 }]).map((candidate) => candidate.student_id), ['S012', 'S010', 'S011']);
});
test('B2 produces consistent WEIGHTED_SCORE, MERGE_SORT, and HEAP_TOPK results', () => {
  const service = new RankingService(createRegistry());
  const weighted = service.computeRanking({ driveId: 'D001', algorithm: 'WEIGHTED_SCORE' });
  const merged = service.computeRanking({ driveId: 'D001', algorithm: 'MERGE_SORT' });
  const heap = service.computeRanking({ driveId: 'D001', algorithm: 'HEAP_TOPK', topK: 3 });
  assert.deepEqual(weighted.ordered_candidates, merged.ordered_candidates);
  assert.deepEqual(weighted.ordered_candidates, heap.ordered_candidates);
  assert.equal(calculateWeightedScore(dummyStudents[0], dummyDrives[0]).score, 96.2);
});

test('B2 algorithms match an independently hand-calculated reference cohort', () => {
  const registry = new ProfileRegistryService();
  registry.addOrUpdateStudent({ student_id: 'A', name: 'A', branch: 'CSE', cgpa: 8, backlogs: 0, attendance: 90, project_score: 80, skill_tags: ['Java'] });
  registry.addOrUpdateStudent({ student_id: 'B', name: 'B', branch: 'CSE', cgpa: 9, backlogs: 0, attendance: 90, project_score: 40, skill_tags: ['Java'] });
  registry.addOrUpdateStudent({ student_id: 'C', name: 'C', branch: 'CSE', cgpa: 7, backlogs: 0, attendance: 90, project_score: 80, skill_tags: ['Java'] });
  registry.addOrUpdateDrive({ drive_id: 'REF', company: 'Reference', criteria: { min_cgpa: 6, max_backlogs: 0, allowed_branches: ['CSE'], min_attendance: 75, required_skill_tags: ['Java'] }, skill_weightage: { Java: 100 }, seats: 3, package: '0', state: 'OPEN', version: 1 });
  const service = new RankingService(registry);
  // Independently hand-calculated: A=94, B=92, C=92; score ties break by higher CGPA.
  const expected = [{ student_id: 'A', score: 94, rank: 1 }, { student_id: 'B', score: 92, rank: 2 }, { student_id: 'C', score: 92, rank: 3 }];
  assert.deepEqual(service.computeRanking({ driveId: 'REF', algorithm: 'WEIGHTED_SCORE' }).ordered_candidates, expected);
  assert.deepEqual(service.computeRanking({ driveId: 'REF', algorithm: 'MERGE_SORT' }).ordered_candidates, expected);
  assert.deepEqual(service.computeRanking({ driveId: 'REF', algorithm: 'HEAP_TOPK', topK: 3 }).ordered_candidates, expected);
});

test('B2 candidate_pool restricts, deduplicates, counts, and rejects unknown IDs deterministically', () => {
  const service = new RankingService(createRegistry());
  const restricted = service.computeRanking({ driveId: 'D001', candidatePool: ['S004'] });
  assert.deepEqual(restricted.ordered_candidates.map((candidate) => candidate.student_id), ['S004']);
  assert.equal(restricted.explored_candidate_count, 1);
  assert.notEqual(restricted.ranking_id, service.computeRanking({ driveId: 'D001' }).ranking_id);
  const empty = service.computeRanking({ driveId: 'D001', candidatePool: [] });
  assert.deepEqual(empty.ordered_candidates, []); assert.equal(empty.explored_candidate_count, 0);
  const duplicates = service.computeRanking({ driveId: 'D001', candidatePool: ['S004', 'S001', 'S004'] });
  assert.deepEqual(duplicates.ordered_candidates.map((candidate) => candidate.student_id), ['S004', 'S001']);
  assert.equal(duplicates.explored_candidate_count, 2);
  assert.equal(duplicates.ranking_id, service.computeRanking({ driveId: 'D001', candidatePool: ['S001', 'S004'] }).ranking_id);
  assert.throws(() => service.computeRanking({ driveId: 'D001', candidatePool: ['S999'] }), /Unknown candidate ID.*S999/);
});

test('B2 supports score maximization and only implemented eligibility/project constraints', () => {
  const service = new RankingService(createRegistry());
  const supported = service.computeRanking({ driveId: 'D001', optimizationMetric: 'SCORE_DESC' });
  assert.equal(supported.optimization_metric, 'SCORE_DESC');
  assert.throws(() => service.computeRanking({ driveId: 'D001', optimizationMetric: 'PACKAGE_MAX' as never }), /Unsupported optimization_metric/);
  const projectCutoff = service.computeRanking({ driveId: 'D001', constraints: { min_project_score: 90 } });
  assert.deepEqual(projectCutoff.ordered_candidates.map((candidate) => candidate.student_id), ['S004']);
  assert.equal(projectCutoff.explored_candidate_count, 5);
  assert.notEqual(projectCutoff.ranking_id, service.computeRanking({ driveId: 'D001' }).ranking_id);
  const cgpaCutoff = service.computeRanking({ driveId: 'D001', constraints: { min_cgpa: 8.8 } });
  assert.deepEqual(cgpaCutoff.ordered_candidates.map((candidate) => candidate.student_id), ['S004']);
  const backlogCutoff = service.computeRanking({ driveId: 'D001', constraints: { max_backlogs: 0 } });
  assert.deepEqual(backlogCutoff.ordered_candidates.map((candidate) => candidate.student_id), ['S004', 'S001']);
  const orderedOptions = service.computeRanking({ driveId: 'D001', constraints: { min_cgpa: 7.5, max_backlogs: 0 } });
  const reversedOptions = service.computeRanking({ driveId: 'D001', constraints: { max_backlogs: 0, min_cgpa: 7.5 } });
  assert.equal(orderedOptions.ranking_id, reversedOptions.ranking_id);
  assert.throws(() => service.computeRanking({ driveId: 'D001', constraints: { unsupported: true } as never }), /Unsupported ranking constraint/);
});

test('B2 HEAP_TOPK ranking IDs distinguish top-K results and retain both for retrieval', () => {
  const service = new RankingService(createRegistry());
  const topOne = service.computeRanking({ driveId: 'D001', algorithm: 'HEAP_TOPK', topK: 1 });
  const topTwo = service.computeRanking({ driveId: 'D001', algorithm: 'HEAP_TOPK', topK: 2 });
  assert.notEqual(topOne.ranking_id, topTwo.ranking_id);
  assert.equal(service.getRanking(topOne.ranking_id)?.ordered_candidates.length, 1);
  assert.equal(service.getRanking(topTwo.ranking_id)?.ordered_candidates.length, 2);
});
test('B2 shortlist handles K boundaries and zero eligible candidates', () => {
  const service = new RankingService(createRegistry());
  const ranked = service.computeRanking({ driveId: 'D001' }).ordered_candidates;
  assert.equal(createShortlist(ranked, 2).length, 2); assert.equal(createShortlist(ranked, ranked.length).length, 3); assert.equal(createShortlist(ranked, 10).length, 3); assert.deepEqual(createShortlist([], 3), []);
  const noCandidatesRegistry = new ProfileRegistryService();
  noCandidatesRegistry.addOrUpdateStudent(dummyStudents[1]); noCandidatesRegistry.addOrUpdateDrive(dummyDrives[0]);
  assert.deepEqual(new RankingService(noCandidatesRegistry).computeRanking({ driveId: 'D001' }).ordered_candidates, []);
});

test('B2 rejects missing, negative, non-finite, and non-100 skill weight vectors', () => {
  const student = dummyStudents[0];
  const invalidWeights: Array<Record<string, number>> = [
    { Java: 40, SQL: 30 },
    { Java: -10, SQL: 50, React: 60 },
    { Java: 40, SQL: 30, React: 20 },
    { Java: 50, SQL: 50, React: 50 },
    { Java: Number.NaN, SQL: 50, React: 50 },
  ];
  for (const weights of invalidWeights) {
    assert.throws(() => calculateWeightedScore(student, { ...dummyDrives[0], skill_weightage: weights }));
  }
});

test('B2 API retrieves computed rankings and returns the error envelope for unknown IDs', async () => {
  const registry = createRegistry(); const ranking = new RankingService(registry);
  const index = new ShortlistIndex('hash'); const cache = new ShortlistCacheService();
  const context = { registry, ranking, lookup: new ShortlistLookupService(index, cache, () => registry.graph_version), analytics: new AnalyticsService([]), metrics: new RankingMetricsService(index, cache) };
  const server = createServer((req, res) => { void handleRequest(req, res, context); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const profileResponse = await fetch(`${base}/api/v1/profiles`);
    const profiles = await profileResponse.json() as { data: { graph: { coverage_summary: { coverage_percentage: number } } } };
    assert.equal(profiles.data.graph.coverage_summary.coverage_percentage, 100);
    const mismatchedVersion = await fetch(`${base}/api/v1/rankings/compute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'D001', graph_version: 'stale-graph' }) });
    const mismatchBody = await mismatchedVersion.json() as { error: { code: string } };
    assert.equal(mismatchedVersion.status, 409);
    assert.equal(mismatchBody.error.code, 'VERSION_MISMATCH');
    const unsupportedMetric = await fetch(`${base}/api/v1/rankings/compute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'D001', optimization_metric: 'PACKAGE_MAX' }) });
    assert.equal(unsupportedMetric.status, 400);
    const unsupportedMetricBody = await unsupportedMetric.json() as { error: { message: string } };
    assert.match(unsupportedMetricBody.error.message, /Unsupported optimization_metric/);
    const unknownPoolId = await fetch(`${base}/api/v1/rankings/compute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'D001', candidate_pool: ['S999'] }) });
    assert.equal(unknownPoolId.status, 400);
    const analyticsValid = await fetch(`${base}/api/v1/analytics/analyse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records: [], algorithm: 'DETERMINISTIC_AGGREGATION', benchmark_size: 0, repetitions: 2 }) });
    assert.equal(analyticsValid.status, 200);
    const analyticsData = (await analyticsValid.json() as { data: { benchmark: { algorithm: string; benchmark_size: number; repetitions: number } } }).data;
    assert.deepEqual([analyticsData.benchmark.algorithm, analyticsData.benchmark.benchmark_size, analyticsData.benchmark.repetitions], ['DETERMINISTIC_AGGREGATION', 0, 2]);
    const analyticsInvalid = await fetch(`${base}/api/v1/analytics/analyse`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records: [], algorithm: 'MAGIC_FAST' }) });
    assert.equal(analyticsInvalid.status, 400);
    const computed = await fetch(`${base}/api/v1/rankings/compute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'D001' }) });
    const payload = await computed.json() as { data: { ranking_id: string } };
    const retrieved = await fetch(`${base}/api/v1/rankings/${payload.data.ranking_id}`);
    assert.equal(retrieved.status, 200);
    assert.deepEqual((await retrieved.json() as { data: unknown }).data, payload.data);
    const topKResults = await Promise.all([1, 2].map(async (top_k) => {
      const response = await fetch(`${base}/api/v1/rankings/compute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drive_id: 'D001', algorithm: 'HEAP_TOPK', top_k }) });
      return (await response.json() as { data: { ranking_id: string; ordered_candidates: unknown[] } }).data;
    }));
    assert.notEqual(topKResults[0].ranking_id, topKResults[1].ranking_id);
    for (let i = 0; i < topKResults.length; i++) {
      const response = await fetch(`${base}/api/v1/rankings/${topKResults[i].ranking_id}`);
      assert.equal(response.status, 200);
      assert.equal(((await response.json() as { data: { ordered_candidates: unknown[] } }).data).ordered_candidates.length, i + 1);
    }
    const missing = await fetch(`${base}/api/v1/rankings/unknown-id`);
    const missingPayload = await missing.json() as { error: { code: string } };
    assert.equal(missing.status, 404);
    assert.equal(missingPayload.error.code, 'NOT_FOUND');
  } finally { server.close(); }
});
