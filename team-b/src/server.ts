import { createApp } from './app';
import { ProfileRegistryService } from './services/profileRegistryService';
import { RankingService } from './services/rankingService';
import { AnalyticsService } from './services/analyticsService';
import { ShortlistIndex } from './services/shortlistIndexService';
import { ShortlistCacheService } from './services/shortlistCacheService';
import { ShortlistLookupService } from './services/shortlistLookupService';
import { RankingMetricsService } from './services/rankingMetricsService';
import { dummyStudents, dummyDrives } from './data/dummyProfiles';

const port = process.env.PORT || 3002;

// Bootstrap services
const registry = new ProfileRegistryService();
const rankingService = new RankingService(registry);
const analyticsService = new AnalyticsService([]);
const shortlistIndexService = new ShortlistIndex('hash');
const shortlistCacheService = new ShortlistCacheService();
const shortlistLookupService = new ShortlistLookupService(shortlistIndexService, shortlistCacheService, (key) => registry.getGraphSummary().graph_version);
const rankingMetricsService = new RankingMetricsService(shortlistIndexService, shortlistCacheService);

// Load dummy data
for (const student of dummyStudents) registry.addOrUpdateStudent(student);
for (const drive of dummyDrives) registry.addOrUpdateDrive(drive);

const app = createApp(
  registry,
  rankingService,
  analyticsService,
  shortlistLookupService,
  shortlistCacheService,
  rankingMetricsService
);

app.listen(port, () => {
  console.log(`Team B Ranking Engine running on port ${port}`);
});
