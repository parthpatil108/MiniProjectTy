import type { RankedCandidate } from '../types';
import { assertCorrelationId, failure, success } from './apiEnvelope';
import type { ShortlistIndex } from './shortlistIndexService';
import { ShortlistCacheService } from './shortlistCacheService';
import { entryFromCandidate } from './shortlistIndexService';

export class ShortlistLookupService {
  constructor(
    private readonly index: ShortlistIndex,
    private readonly cache: ShortlistCacheService,
    private readonly currentProfileVersion: (shortlistKey: string) => string | undefined,
  ) {}
  getByKey(key: string, correlationId?: string) {
    assertCorrelationId(correlationId);
    const lookup = this.index.get(key);
    if (!lookup.entry) return { status: 404 as const, body: failure('NOT_FOUND', `No shortlist entry for key: ${key}`, correlationId) };
    const expectedVersion = this.currentProfileVersion(lookup.entry.shortlist_key);
    const cached = this.cache.get(lookup.entry.shortlist_key, expectedVersion);
    const stats = { ...lookup.statistics, ...this.cache.statistics() };
    if (cached.status !== 'hit') {
      const code = cached.status === 'version_mismatch' ? 'VERSION_MISMATCH' : 'NOT_FOUND';
      return { status: 404 as const, body: failure(code, `Shortlist cache ${cached.status}; stale data was not returned.`, correlationId) };
    }
    return { status: 200 as const, body: success({ rank: lookup.entry.rank, cached_shortlist: { entries: cached.value.entries }, lookup_time_us: lookup.lookup_time_us, cache_hit: true, index_statistics: stats }, correlationId) };
  }
  invalidate(input: unknown, correlationId?: string) {
    assertCorrelationId(correlationId);
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof (input as { key?: unknown }).key !== 'string' || !(input as { key: string }).key.trim()
      || typeof (input as { profile_version?: unknown }).profile_version !== 'string' || !(input as { profile_version: string }).profile_version.trim()) {
      return { status: 400 as const, body: failure('VALIDATION_ERROR', 'key and profile_version must be non-empty strings.', correlationId) };
    }
    const validInput = input as { key: string; profile_version: string };
    const result = this.cache.invalidate(validInput.key, validInput.profile_version);
    if (result === 'version_mismatch') return { status: 400 as const, body: failure('VALIDATION_ERROR', 'profile_version does not match the cached version; cache was left unchanged.', correlationId, 'profile_version') };
    this.removeEntriesForShortlist(validInput.key);
    return { status: 200 as const, body: success({ invalidated: result === 'invalidated', result }, correlationId) };
  }
  putShortlist(key: string, profileVersion: string, candidates: RankedCandidate[], ttlMs: number): void {
    const newStudentIds = new Set(candidates.map((candidate) => candidate.student_id));
    const newKeys = candidates.map((candidate) => candidateIndexKey(key, candidate.student_id));
    this.cache.set(key, candidates, profileVersion, ttlMs);
    for (const [oldKey, oldEntry] of this.index.entries()) {
      if (oldEntry.shortlist_key === key && !newStudentIds.has(oldEntry.student_id)) this.index.delete(oldKey);
    }
    candidates.forEach((candidate, i) => this.index.set(newKeys[i], entryFromCandidate(candidate, key, profileVersion)));
  }
  private removeEntriesForShortlist(shortlistKey: string): void {
    for (const [candidateKey, entry] of this.index.entries()) if (entry.shortlist_key === shortlistKey) this.index.delete(candidateKey);
  }
}

export function candidateIndexKey(shortlistKey: string, studentId: string): string {
  return `${encodeURIComponent(shortlistKey)}::${encodeURIComponent(studentId)}`;
}
