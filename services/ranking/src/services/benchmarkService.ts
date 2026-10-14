import { AvlTree } from './avlTree';
import type { RankedCandidate } from '../types';
import { analysePlacements } from './analyticsService';
import type { HistoricalPlacementRecord } from '../types';

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
