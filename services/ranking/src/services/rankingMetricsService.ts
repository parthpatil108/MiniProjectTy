import { assertCorrelationId, success } from './apiEnvelope';
import type { ShortlistIndex } from './shortlistIndexService';
import type { ShortlistCacheService } from './shortlistCacheService';

export class RankingMetricsService {
  constructor(private readonly index: ShortlistIndex, private readonly cache: ShortlistCacheService) {}
  getRankingMetrics(correlationId?: string) {
    assertCorrelationId(correlationId);
    const cache = this.cache.statistics(); const attempts = cache.cache_hits + cache.cache_misses;
    return { status: 200 as const, body: success({ cache_hit_rate: attempts ? cache.cache_hits / attempts : 0, index_lookup_p95_ms: this.index.p95LookupTimeMs() }, correlationId) };
  }
}
