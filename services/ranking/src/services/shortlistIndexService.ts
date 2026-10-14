import { AvlTree } from './avlTree';
import type { RankedCandidate, ShortlistEntry } from '../types';

export interface IndexedEntry extends ShortlistEntry { shortlist_key: string; profile_version: string }
export interface IndexStatistics { total_entries: number; lookup_count: number; cache_hits: number; cache_misses: number }
export interface IndexResult { entry?: IndexedEntry; lookup_time_us: number; statistics: IndexStatistics }

export class ShortlistIndex<T extends IndexedEntry = IndexedEntry> {
  private readonly map = new Map<string, T>();
  private readonly tree = new AvlTree<T>();
  private lookups = 0;
  private readonly lookupDurationsUs: number[] = [];
  constructor(private readonly kind: 'hash' | 'avl') {}
  get size(): number { return this.map.size; }
  set(key: string, value: T): void { this.map.set(key, value); this.tree.set(key, value); }
  delete(key: string): boolean { const existed = this.map.delete(key); this.tree.delete(key); return existed; }
  get(key: string): IndexResult {
    const start = process.hrtime.bigint();
    const entry = this.kind === 'hash' ? this.map.get(key) : this.tree.get(key);
    const lookup_time_us = Number(process.hrtime.bigint() - start) / 1_000;
    this.lookupDurationsUs.push(lookup_time_us);
    this.lookups += 1;
    return { entry, lookup_time_us, statistics: { total_entries: this.size, lookup_count: this.lookups, cache_hits: 0, cache_misses: 0 } };
  }
  values(): T[] { return [...this.map.values()]; }
  entries(): Array<[string, T]> { return [...this.map.entries()]; }
  isBalanced(): boolean { return this.tree.validateBalance(); }
  p95LookupTimeMs(): number { const sorted = [...this.lookupDurationsUs].sort((a, b) => a - b); return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] / 1_000 : 0; }
}

export type IndexKind = 'hash' | 'avl';
export function entryFromCandidate(candidate: RankedCandidate, shortlist_key: string, profile_version: string): IndexedEntry {
  return { ...candidate, shortlist_key, profile_version };
}
