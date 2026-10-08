import { createApp } from './app';
import { ProfileRegistryService } from './services/profileRegistryService';
import { RankingService } from './services/rankingService';
import { AnalyticsService } from './services/analyticsService';
import { ShortlistIndex } from './services/shortlistIndexService';
import { ShortlistCacheService } from './services/shortlistCacheService';
import { ShortlistLookupService } from './services/shortlistLookupService';
import { RankingMetricsService } from './services/rankingMetricsService';
import { Student, Drive } from './types';

const port = process.env.PORT || 3002;

// Bootstrap services
const registry = new ProfileRegistryService();
const rankingService = new RankingService(registry);
const analyticsService = new AnalyticsService([]);
const shortlistIndexService = new ShortlistIndex('hash');
const shortlistCacheService = new ShortlistCacheService();
const shortlistLookupService = new ShortlistLookupService(shortlistIndexService, shortlistCacheService, (key) => registry.getGraphSummary().graph_version);
const rankingMetricsService = new RankingMetricsService(shortlistIndexService, shortlistCacheService);

const TEAM_C_URL = process.env.TEAM_C_URL || 'http://localhost:3003';

async function syncWithTeamC() {
  try {
    const studentsRes = await fetch(`${TEAM_C_URL}/api/v1/students`);
    if (studentsRes.ok) {
      const { data } = await studentsRes.json();
      data.forEach((student: Student) => registry.addOrUpdateStudent(student));
    }
    const drivesRes = await fetch(`${TEAM_C_URL}/api/v1/drives`);
    if (drivesRes.ok) {
      const { data } = await drivesRes.json();
      data.forEach((drive: Drive) => registry.addOrUpdateDrive(drive));
    }
    console.log('Synced with Team C successfully.');
  } catch (err) {
    console.error('Failed to sync with Team C:', err);
  }
}

// Initial sync
syncWithTeamC();
setInterval(syncWithTeamC, 10000); // Periodic sync

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
