import { createServer } from 'node:http';

import { AnalyticsService } from '../services/analyticsService';
import { RankingMetricsService } from '../services/rankingMetricsService';
import { RankingService } from '../services/rankingService';
import { ProfileRegistryService } from '../services/profileRegistryService';
import { ShortlistCacheService } from '../services/shortlistCacheService';
import { ShortlistIndex } from '../services/shortlistIndexService';
import { ShortlistLookupService } from '../services/shortlistLookupService';

import { dummyStudents, dummyDrives } from '../data/dummyProfiles';
import { handleRequest } from './router';

const PORT = Number(process.env.PORT ?? 3000);

const registry = new ProfileRegistryService();

for (const student of dummyStudents) {
  registry.addOrUpdateStudent(student);
}

for (const drive of dummyDrives) {
  registry.addOrUpdateDrive(drive);
}

const rankingService = new RankingService(registry);

const shortlistIndex = new ShortlistIndex('hash');
const shortlistCache = new ShortlistCacheService();

const shortlistLookupService = new ShortlistLookupService(
  shortlistIndex,
  shortlistCache,
  () => registry.graph_version
);

const analyticsService = new AnalyticsService([]);

const rankingMetricsService = new RankingMetricsService(
  shortlistIndex,
  shortlistCache
);

const server = createServer((req, res) => {
  void handleRequest(req, res, {
    registry,
    ranking: rankingService,
    lookup: shortlistLookupService,
    analytics: analyticsService,
    metrics: rankingMetricsService
  });
});

server.listen(PORT, () => {
  console.log(`Team B API running at http://localhost:${PORT}`);
});