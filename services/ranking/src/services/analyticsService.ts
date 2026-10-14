import type { HistoricalPlacementRecord, PlacementStage } from '../types';
import { assertCorrelationId, failure, success } from './apiEnvelope';

export interface AnalyticsFilters { department_filter?: string; batch?: string }
export interface DepartmentTrend { department: string; batch: string; represented_students: number; placed_students: number; placement_rate: number }
export interface PackageDistribution { buckets: Record<string, number>; missing_or_invalid: number; valid_placed_records: number }
export interface AnalyticsResult { department_trend: Record<string, DepartmentTrend>; conversion_rate: number; package_distribution: PackageDistribution }
export function validateAnalyticsFilters(filters: unknown): AnalyticsFilters {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new TypeError('Analytics filters must be an object.');
  const value = filters as Record<string, unknown>;
  if (value.department_filter !== undefined && typeof value.department_filter !== 'string') throw new TypeError('department_filter must be a string.');
  if (value.batch !== undefined && typeof value.batch !== 'string') throw new TypeError('batch must be a string.');
  return value as AnalyticsFilters;
}
const STAGES: PlacementStage[] = ['Applied', 'Eligible', 'Shortlisted', 'Placed'];
const BUCKETS = [
  { label: '0-<3 LPA', min: 0, max: 3 }, { label: '3-<6 LPA', min: 3, max: 6 },
  { label: '6-<10 LPA', min: 6, max: 10 }, { label: '10+ LPA', min: 10, max: Infinity },
];
function validate(record: HistoricalPlacementRecord, i: number): string | undefined {
  if (!record || typeof record !== 'object') return `records[${i}] must be an object`;
  for (const field of ['student_id', 'department', 'batch', 'company'] as const) if (typeof record[field] !== 'string' || !record[field].trim()) return `records[${i}].${field} is required`;
  if (!STAGES.includes(record.stage)) return `records[${i}].stage is invalid`;
  return undefined;
}
function deduplicate(records: HistoricalPlacementRecord[]): HistoricalPlacementRecord[] {
  // A student-company key is unique for this MVP (cycle is not a model field).
  // Keep the most advanced explicitly observed stage; for duplicate Placed records,
  // choose the lowest valid package so repeated submissions cannot inflate totals.
  const rank: Record<PlacementStage, number> = { Applied: 0, Eligible: 1, Shortlisted: 2, Placed: 3 };
  const unique = new Map<string, HistoricalPlacementRecord>();
  for (const record of records) {
    const key = `${record.student_id}\u0000${record.company}`;
    const previous = unique.get(key);
    if (previous && (previous.department !== record.department || previous.batch !== record.batch)) throw new Error(`Conflicting department or batch for duplicate student-company record ${record.student_id}/${record.company}`);
    if (!previous || rank[record.stage] > rank[previous.stage]) unique.set(key, { ...record });
    else if (record.stage === 'Placed' && previous.stage === 'Placed') {
      const valid = [record.package_lpa, previous.package_lpa].filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0);
      unique.set(key, { ...previous, package_lpa: valid.length ? Math.min(...valid) : record.package_lpa });
    }
  }
  return [...unique.values()];
}
export function analysePlacements(records: HistoricalPlacementRecord[], filters: AnalyticsFilters = {}): AnalyticsResult {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  records.forEach((record, i) => { const issue = validate(record, i); if (issue) throw new Error(issue); });
  const filtered = deduplicate(records.filter((r) => (!filters.department_filter || r.department === filters.department_filter) && (!filters.batch || r.batch === filters.batch)));
  const cohorts = new Map<string, { department: string; batch: string; represented: Set<string>; placed: Set<string> }>();
  for (const r of filtered) {
    const key = `${r.department}\u0000${r.batch}`;
    let cohort = cohorts.get(key);
    if (!cohort) { cohort = { department: r.department, batch: r.batch, represented: new Set(), placed: new Set() }; cohorts.set(key, cohort); }
    cohort.represented.add(r.student_id);
    if (r.stage === 'Placed') cohort.placed.add(r.student_id);
  }
  const department_trend: Record<string, DepartmentTrend> = {};
  for (const c of [...cohorts.values()].sort((a, b) => a.department.localeCompare(b.department) || a.batch.localeCompare(b.batch))) {
    const key = `${encodeURIComponent(c.department)}::${encodeURIComponent(c.batch)}`;
    department_trend[key] = { department: c.department, batch: c.batch, represented_students: c.represented.size, placed_students: c.placed.size, placement_rate: c.represented.size ? c.placed.size / c.represented.size * 100 : 0 };
  }
  const companies = new Map<string, { applied: Set<string>; placed: Set<string> }>();
  for (const r of filtered) {
    let company = companies.get(r.company);
    if (!company) { company = { applied: new Set(), placed: new Set() }; companies.set(r.company, company); }
    company.applied.add(r.student_id); // Every valid record is an application, regardless of its current stage.
    if (r.stage === 'Placed') company.placed.add(r.student_id);
  }
  const applied = [...companies.values()].reduce((n, c) => n + c.applied.size, 0);
  const placed = [...companies.values()].reduce((n, c) => n + c.placed.size, 0);
  const buckets: Record<string, number> = Object.fromEntries(BUCKETS.map((b) => [b.label, 0]));
  let missing_or_invalid = 0; let valid_placed_records = 0;
  for (const r of filtered) if (r.stage === 'Placed') {
    const value = r.package_lpa;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) { missing_or_invalid++; continue; }
    const bucket = BUCKETS.find((b) => value >= b.min && value < b.max)!;
    buckets[bucket.label]++; valid_placed_records++;
  }
  return { department_trend, conversion_rate: applied ? placed / applied * 100 : 0, package_distribution: { buckets, missing_or_invalid, valid_placed_records } };
}

export class AnalyticsService {
  constructor(private readonly records: HistoricalPlacementRecord[]) {}
  analyse(filters: AnalyticsFilters, correlationId?: string) {
    assertCorrelationId(correlationId);
    const validatedFilters = validateAnalyticsFilters(filters);
    try { return { status: 200 as const, body: success(analysePlacements(this.records, validatedFilters), correlationId) }; }
    catch (error) { return { status: 400 as const, body: failure('VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid historical records.', correlationId) }; }
  }
}
