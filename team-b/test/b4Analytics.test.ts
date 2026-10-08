import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoricalPlacementRecord } from '../src/types';
import { analysePlacements, AnalyticsService, validateAnalyticsFilters } from '../src/services/analyticsService';
const data: HistoricalPlacementRecord[] = [
  { student_id: '1', department: 'CSE', batch: '2026', company: 'Acme', stage: 'Applied' },
  { student_id: '1', department: 'CSE', batch: '2026', company: 'Acme', stage: 'Placed', package_lpa: 12 },
  { student_id: '2', department: 'CSE', batch: '2026', company: 'Acme', stage: 'Applied' },
  { student_id: '3', department: 'ECE', batch: '2025', company: 'Beta', stage: 'Placed', package_lpa: 5 },
  { student_id: '4', department: 'CSE', batch: '2026', company: 'Other', stage: 'Placed' },
];
test('B4 handles empty data and emits zero metrics deterministically', () => {
  assert.deepEqual(analysePlacements([]), { department_trend: {}, conversion_rate: 0, company_conversion: {}, package_distribution: { buckets: { '0-<3 LPA': 0, '3-<6 LPA': 0, '6-<10 LPA': 0, '10+ LPA': 0 }, missing_or_invalid: 0, valid_placed_records: 0 } });
});
test('cohort, department and batch filters have expected aggregates and stable ordering', () => {
  const result = analysePlacements(data); const cohorts = Object.values(result.department_trend); const cse = cohorts[0]; assert.deepEqual([cse.department, cse.batch, cse.represented_students, cse.placed_students], ['CSE', '2026', 3, 2]); assert.ok(Math.abs(cse.placement_rate - 200 / 3) < 1e-10); assert.deepEqual(cohorts[1], { department: 'ECE', batch: '2025', represented_students: 1, placed_students: 1, placement_rate: 100 });
  assert.deepEqual(Object.values(analysePlacements(data, { department_filter: 'CSE', batch: '2026' }).department_trend).map((x) => x.department), ['CSE']);
  assert.deepEqual(analysePlacements(data, { batch: 'unknown' }).department_trend, {});
});
test('company conversion deduplicates student-company applications and placement outcomes', () => {
  assert.equal(analysePlacements(data).conversion_rate, 75); // 3 placed student-company records / 4 applied student-company records.
  assert.deepEqual(analysePlacements(data).company_conversion, { Acme: { applied: 2, placed: 1, conversion_rate: 50 }, Beta: { applied: 1, placed: 1, conversion_rate: 100 }, Other: { applied: 1, placed: 1, conversion_rate: 100 } });
});
test('package buckets count each valid placed record once and classify missing or invalid values', () => {
  const result = analysePlacements(data).package_distribution; assert.deepEqual(result.buckets, { '0-<3 LPA': 0, '3-<6 LPA': 1, '6-<10 LPA': 0, '10+ LPA': 1 }); assert.equal(result.missing_or_invalid, 1); assert.equal(result.valid_placed_records, 2);
  const invalid: HistoricalPlacementRecord[] = [{ student_id: 'x', department: 'CSE', batch: '2026', company: 'C', stage: 'Placed', package_lpa: Number.NaN }]; assert.equal(analysePlacements(invalid).package_distribution.missing_or_invalid, 1);
});
test('package boundaries 0, 3, 6, and 10 map to the documented half-open LPA buckets', () => {
  const boundaryRecords: HistoricalPlacementRecord[] = [0, 3, 6, 10].map((package_lpa, i) => ({ student_id: `boundary-${i}`, department: 'CSE', batch: '2026', company: 'C', stage: 'Placed', package_lpa }));
  const distribution = analysePlacements(boundaryRecords).package_distribution;
  assert.deepEqual(distribution.buckets, { '0-<3 LPA': 1, '3-<6 LPA': 1, '6-<10 LPA': 1, '10+ LPA': 1 });
  assert.equal(distribution.valid_placed_records, 4);
});
test('missing, negative, NaN, and infinite package values are separated; zero LPA is valid in the [0,3) bucket', () => {
  const packages: Array<number | undefined> = [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0];
  const records: HistoricalPlacementRecord[] = packages.map((package_lpa, i) => ({ student_id: `invalid-${i}`, department: 'CSE', batch: '2026', company: 'C', stage: 'Placed', ...(package_lpa === undefined ? {} : { package_lpa }) }));
  const distribution = analysePlacements(records).package_distribution;
  assert.equal(distribution.missing_or_invalid, 5); assert.equal(distribution.valid_placed_records, 1); assert.equal(distribution.buckets['0-<3 LPA'], 1);
});
test('invalid or missing required fields fail with a contract-shaped validation envelope', () => {
  const bad = [{ student_id: 'x', department: '', batch: '2026', company: 'C', stage: 'Applied' }] as unknown as HistoricalPlacementRecord[];
  assert.throws(() => analysePlacements(bad), /department is required/);
  const response = new AnalyticsService(bad).analyse({}); assert.equal(response.status, 400); if (response.status === 400) assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});
test('analytics adapter validates filters and externally supplied correlation IDs', () => {
  assert.throws(() => validateAnalyticsFilters({ batch: 2026 }), /batch must be a string/);
  assert.throws(() => new AnalyticsService([]).analyse({ department_filter: 10 } as unknown as { department_filter?: string }, 'not-a-uuid'), /X-Correlation-ID must be a UUID v4/);
  assert.throws(() => new AnalyticsService([]).analyse({ department_filter: 10 } as unknown as { department_filter?: string }), /department_filter must be a string/);
});

test('B4 analytics reports the supported aggregation algorithm, benchmark size, and repetitions', () => {
  const service = new AnalyticsService(data);
  const response = service.analyse({}, undefined, { algorithm: 'DETERMINISTIC_AGGREGATION', benchmarkSize: data.length, repetitions: 3 });
  assert.equal(response.status, 200);
  if (response.status === 200) {
    const { benchmark, ...analytics } = response.body.data;
    assert.deepEqual(analytics, analysePlacements(data));
    assert.equal(benchmark.algorithm, 'DETERMINISTIC_AGGREGATION');
    assert.equal(benchmark.benchmark_size, data.length);
    assert.equal(benchmark.repetitions, 3);
    assert.ok(benchmark.elapsed_ms >= 0);
    assert.ok(benchmark.average_duration_ms >= 0);
  }
  assert.equal(service.analyse({}, undefined, { algorithm: 'UNSUPPORTED' }).status, 400);
  assert.equal(service.analyse({}, undefined, { repetitions: 0 }).status, 400);
  assert.equal(service.analyse({}, undefined, { repetitions: 101 }).status, 400);
  assert.equal(service.analyse({}, undefined, { repetitions: 1.5 }).status, 400);
  assert.equal(service.analyse({}, undefined, { benchmarkSize: data.length - 1 }).status, 400);
});
test('duplicates consolidate to the most advanced observed stage and repeatable ordering', () => {
  const result = analysePlacements(data); assert.deepEqual(analysePlacements([...data].reverse()), result);
  assert.equal(Object.values(result.department_trend)[0].placed_students, 2);
  assert.throws(() => analysePlacements([...data, { ...data[0], department: 'ECE' }]), /Conflicting department or batch/);
});
