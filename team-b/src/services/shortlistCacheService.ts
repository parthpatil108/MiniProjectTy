import type { RankedCandidate } from '../types';

export interface ShortlistCacheValue { entries: RankedCandidate[]; expires_at: number; profile_version: string }
export type CacheRead = { status: 'hit'; value: ShortlistCacheValue } | { status: 'miss' | 'expired' | 'version_mismatch' };
export class ShortlistCacheService {
  private readonly entries = new Map<string, ShortlistCacheValue>();
  private hits = 0; private misses = 0;
  constructor(private readonly now: () => number = Date.now) {}
  set(key: string, entries: RankedCandidate[], profileVersion: string, ttlMs: number): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('ttlMs must be positive and finite');
    this.entries.set(key, { entries: entries.map((entry) => ({ ...entry })), expires_at: this.now() + ttlMs, profile_version: profileVersion });
  }
  get(key: string, currentProfileVersion: string | undefined): CacheRead {
    const value = this.entries.get(key);
    if (!value) { this.misses++; return { status: 'miss' }; }
    if (value.expires_at <= this.now()) { this.entries.delete(key); this.misses++; return { status: 'expired' }; }
    if (currentProfileVersion === undefined || value.profile_version !== currentProfileVersion) { this.entries.delete(key); this.misses++; return { status: 'version_mismatch' }; }
    this.hits++; return { status: 'hit', value: { ...value, entries: value.entries.map((entry) => ({ ...entry })) } };
  }
  invalidate(key: string, profileVersion: string): 'invalidated' | 'missing' | 'version_mismatch' {
    const value = this.entries.get(key);
    if (!value) return 'missing';
    if (value.profile_version !== profileVersion) return 'version_mismatch';
    this.entries.delete(key); return 'invalidated';
  }
  statistics(): { cache_hits: number; cache_misses: number } { return { cache_hits: this.hits, cache_misses: this.misses }; }
  get size(): number { return this.entries.size; }
}
