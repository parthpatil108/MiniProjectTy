import { loadConfig } from '../packages/common/src/config.js';
import { seedDatabase } from '../services/data-engine/src/seed/seedData.js';
import { UserService } from '../services/data-engine/src/services/userService.js';
import { StorageManager } from '../services/data-engine/src/storage/storageManager.js';

async function runSeed() {
  const config = loadConfig();
  const dataEngineUrl = config.DATA_ENGINE_URL || 'http://localhost:3003';
  const serviceSecret = config.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';

  console.log(`[Seed Script] Checking if Team C is running at ${dataEngineUrl}...`);

  let isTeamCRunning = false;
  try {
    const healthRes = await fetch(`${dataEngineUrl}/healthz`, { signal: AbortSignal.timeout(2000) });
    if (healthRes.ok) {
      isTeamCRunning = true;
    }
  } catch {
    isTeamCRunning = false;
  }

  if (isTeamCRunning) {
    console.log('[Seed Script] Team C is online! Seeding through the front door (POST /internal/v1/seed)...');
    try {
      const seedRes = await fetch(`${dataEngineUrl}/internal/v1/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': serviceSecret,
          'X-Correlation-ID': 'seed-script-' + Date.now()
        }
      });

      if (!seedRes.ok) {
        const errText = await seedRes.text();
        throw new Error(`Seed endpoint failed with status ${seedRes.status}: ${errText}`);
      }

      const body = (await seedRes.json()) as any;
      console.log(`[Seed Script] Successfully seeded through API:`, body.data);
      return;
    } catch (err: any) {
      console.warn(`[Seed Script] Front-door seed failed: ${err.message}. Falling back to direct database seed.`);
    }
  } else {
    console.log('[Seed Script] Team C is offline. Performing direct offline database seed into DATA_DIR...');
  }

  // Direct offline seed fallback
  const storage = StorageManager.getInstance();
  const seedResult = seedDatabase(storage);
  const usersCount = await UserService.getInstance().seedDefaultUsers();
  console.log(`[Seed Script] Direct offline seed complete: ${seedResult.studentsCount} students, ${seedResult.drivesCount} drives, ${usersCount} users.`);
}

runSeed().catch((err) => {
  console.error('[Seed Script FATAL]', err);
  process.exit(1);
});
