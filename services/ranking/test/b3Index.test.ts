import assert from 'node:assert/strict';
import test from 'node:test';
import { AvlTree } from '../src/services/avlTree';
import { ShortlistCacheService } from '../src/services/shortlistCacheService';
import { ShortlistIndex } from '../src/services/shortlistIndexService';
import { candidateIndexKey, ShortlistLookupService } from '../src/services/shortlistLookupService';
import { RankingMetricsService } from '../src/services/rankingMetricsService';

test('hash index inserts, retrieves, updates, deletes, and handles missing and empty keys', () => {
  const index = new ShortlistIndex('hash'); assert.equal(index.get('x').entry, undefined); assert.equal(index.size, 0);
  index.set('x', { student_id: 'x', rank: 1, score: 9, shortlist_key: 's', profile_version: 'v1' }); assert.equal(index.get('x').entry?.score, 9);
  index.set('x', { student_id: 'x', rank: 2, score: 10, shortlist_key: 's', profile_version: 'v2' }); assert.equal(index.get('x').entry?.rank, 2); assert.equal(index.get('x').entry?.profile_version, 'v2'); assert.equal(index.delete('x'), true); assert.equal(index.delete('no'), false);
});
test('AVL tree performs LL, RR, LR, and RL rotations and stays balanced through deletion', () => {
  for (const keys of [['c','b','a'], ['a','b','c'], ['c','a','b'], ['a','c','b']]) {
    const tree = new AvlTree<number>(); keys.forEach((key, i) => tree.set(key, i)); assert.equal(tree.validateBalance(), true); assert.equal(tree.size, 3); assert.equal(tree.get('b'), keys.indexOf('b'));
    tree.delete('a'); assert.equal(tree.validateBalance(), true); tree.set('d', 4); assert.equal(tree.validateBalance(), true);
  }
});
test('updating an existing AVL key changes its value without changing size or breaking height invariants', () => {
  const tree = new AvlTree<number>(); ['m', 'g', 't', 'd', 'j', 'p', 'w'].forEach((key, value) => tree.set(key, value));
  const sizeBefore = tree.size; tree.set('g', 999);
  assert.equal(tree.size, sizeBefore); assert.equal(tree.get('g'), 999); assert.equal(tree.validateBalance(), true);
});
test('hash and AVL indexes return the same values for hits and misses', () => {
  const hash = new ShortlistIndex('hash'); const avl = new ShortlistIndex('avl');
  for (let i = 0; i < 40; i++) { const v = { student_id: `${i}`, rank: i + 1, score: i, shortlist_key: 's', profile_version: 'v1' }; hash.set(v.student_id, v); avl.set(v.student_id, v); }
  for (const key of ['0', '17', '39', 'missing']) assert.deepEqual(hash.get(key).entry, avl.get(key).entry);
  assert.equal(typeof hash.get('0').lookup_time_us, 'number'); assert.ok(hash.isBalanced()); assert.ok(avl.isBalanced());
});
test('cache tracks hits and misses, expires deterministically, detects versions and protects newer versions on invalidation', () => {
  let now = 100; const cache = new ShortlistCacheService(() => now); const entries = [{ student_id: 's1', rank: 1, score: 8 }];
  assert.equal(cache.get('x', 'v1').status, 'miss'); cache.set('x', entries, 'v1', 10); assert.equal(cache.get('x', 'v1').status, 'hit');
  const noVersion = (cache.get as unknown as (key: string, version?: string) => ReturnType<typeof cache.get>)('x');
  assert.equal(noVersion.status, 'version_mismatch'); assert.ok(!('value' in noVersion));
  cache.set('x', entries, 'v1', 10);
  const mismatch = cache.get('x', 'v2'); assert.equal(mismatch.status, 'version_mismatch'); assert.ok(!('value' in mismatch));
  cache.set('x', entries, 'v2', 10); assert.equal(cache.invalidate('x', 'v1'), 'version_mismatch'); assert.equal(cache.get('x', 'v2').status, 'hit');
  assert.equal(cache.invalidate('x', 'v2'), 'invalidated');
  cache.set('x', entries, 'v2', 10); now = 110; assert.equal(cache.get('x', 'v2').status, 'expired'); assert.deepEqual(cache.statistics(), { cache_hits: 2, cache_misses: 4 });
});
test('lookup uses cached B2 shortlist output and returns contract envelope or prevents stale data', () => {
  let version: string | undefined = 'v1'; const cache = new ShortlistCacheService(() => 0); const index = new ShortlistIndex('hash');
  const lookup = new ShortlistLookupService(index, cache, () => version); lookup.putShortlist('drive-1', 'v1', [{ student_id: 's1', rank: 1, score: 99 }], 50);
  const candidateKey = candidateIndexKey('drive-1', 's1'); const correlationId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'; const hit = lookup.getByKey(candidateKey, correlationId); assert.equal(hit.status, 200); if (hit.status === 200) { assert.equal(hit.body.meta.correlation_id, correlationId); assert.equal(hit.body.data.lookup_time_us >= 0, true); assert.equal(hit.body.data.cache_hit, true); }
  version = 'v2'; const stale = lookup.getByKey(candidateKey); assert.equal(stale.status, 404); if (stale.status === 404) assert.equal(stale.body.error.code, 'VERSION_MISMATCH');
  const invalid = lookup.invalidate({ key: 'drive-1', profile_version: 'v2' }); assert.equal(invalid.status, 200); assert.equal(lookup.getByKey(candidateKey).status, 404);
});
test('replacing a shortlist reconciles keys without disturbing another shortlist; invalidation and repopulation stay coherent', () => {
  const versions = new Map([['K', 'v1'], ['Other', 'o1']]); const cache = new ShortlistCacheService(() => 0); const index = new ShortlistIndex('hash');
  const lookup = new ShortlistLookupService(index, cache, (key) => versions.get(key));
  const shortlist = (ids: string[], offset: number) => ids.map((student_id, i) => ({ student_id, rank: i + 1, score: offset + i }));
  lookup.putShortlist('K', 'v1', shortlist(['A', 'B', 'C'], 10), 100);
  lookup.putShortlist('Other', 'o1', shortlist(['B'], 50), 100);
  versions.set('K', 'v2'); lookup.putShortlist('K', 'v2', shortlist(['A', 'C'], 20), 100);
  const a = lookup.getByKey(candidateIndexKey('K', 'A')); const c = lookup.getByKey(candidateIndexKey('K', 'C'));
  assert.equal(a.status, 200); assert.equal(c.status, 200);
  if (a.status === 200) { assert.equal(a.body.data.rank, 1); assert.equal(a.body.data.cached_shortlist.entries[0].score, 20); }
  if (c.status === 200) { assert.equal(c.body.data.rank, 2); assert.equal(c.body.data.cached_shortlist.entries[1].score, 21); }
  assert.equal(index.get(candidateIndexKey('K', 'A')).entry?.profile_version, 'v2');
  assert.equal(lookup.getByKey(candidateIndexKey('K', 'B')).status, 404);
  assert.equal(lookup.getByKey(candidateIndexKey('Other', 'B')).status, 200);
  assert.equal(lookup.invalidate({ key: 'K', profile_version: 'v1' }).status, 400);
  assert.equal(lookup.getByKey(candidateIndexKey('K', 'A')).status, 200);
  const invalidated = lookup.invalidate({ key: 'K', profile_version: 'v2' }); assert.equal(invalidated.status, 200);
  assert.equal(lookup.getByKey(candidateIndexKey('K', 'A')).status, 404);
  assert.equal(lookup.getByKey(candidateIndexKey('Other', 'B')).status, 200);
  versions.set('K', 'v3'); lookup.putShortlist('K', 'v3', shortlist(['D'], 70), 100);
  assert.equal(lookup.getByKey(candidateIndexKey('K', 'B')).status, 404);
  const d = lookup.getByKey(candidateIndexKey('K', 'D')); assert.equal(d.status, 200);
  if (d.status === 200) assert.equal(d.body.data.cached_shortlist.entries[0].score, 70);
});
test('service adapters validate invalidation body fields and correlation IDs', () => {
  const cache = new ShortlistCacheService(() => 0); const index = new ShortlistIndex('hash'); const lookup = new ShortlistLookupService(index, cache, () => undefined);
  const badBody = lookup.invalidate({ key: 10, profile_version: true }); assert.equal(badBody.status, 400);
  assert.throws(() => lookup.getByKey('x', 'not-a-uuid'), /X-Correlation-ID must be a UUID v4/);
  assert.throws(() => new RankingMetricsService(index, cache).getRankingMetrics('bad-id'), /X-Correlation-ID must be a UUID v4/);
});
test('lookup refuses cache entries when current profile version cannot be verified; ranking metrics expose measured values', () => {
  const cache = new ShortlistCacheService(() => 0); const index = new ShortlistIndex('hash'); const lookup = new ShortlistLookupService(index, cache, () => undefined);
  lookup.putShortlist('s', 'v1', [{ student_id: 's', rank: 1, score: 1 }], 100);
  const result = lookup.getByKey(candidateIndexKey('s', 's')); assert.equal(result.status, 404); if (result.status === 404) assert.equal(result.body.error.code, 'VERSION_MISMATCH');
  const metrics = new RankingMetricsService(index, cache).getRankingMetrics(); assert.equal(metrics.status, 200); assert.ok(metrics.body.data.index_lookup_p95_ms >= 0); assert.equal(metrics.body.data.cache_hit_rate, 0);
});
