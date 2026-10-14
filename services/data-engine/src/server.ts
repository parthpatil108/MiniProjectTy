import dotenv from 'dotenv';
import { app } from './app.js';
import { UserService } from './services/userService.js';
import { WalRecovery } from './storage/wal/recovery.js';
import { WalWriter } from './storage/wal/walWriter.js';
import { StorageManager } from './storage/storageManager.js';
import { seedDatabase } from './seed/seedData.js';
import { loadConfig, createLogger } from '@apnileap/common';

dotenv.config();
const config = loadConfig();
const logger = createLogger('data-engine', config.LOG_LEVEL);
const PORT = config.DATA_ENGINE_PORT || 3003;

const server = app.listen(PORT, async () => {
  logger.info({ port: PORT, env: config.NODE_ENV, dataDir: config.DATA_DIR }, 'Team C Data Engine listening');

  // 1. Startup WAL Recovery
  try {
    const walRecovery = new WalRecovery();
    const recoveryReport = walRecovery.recover();
    logger.info(
      {
        status: recoveryReport.status,
        lastCheckpointLsn: recoveryReport.lastCheckpointLsn,
        replayedCount: recoveryReport.replayedCount,
        committedTxnCount: recoveryReport.committedTxnCount
      },
      '[Team C] Startup WAL recovery complete'
    );
  } catch (err: any) {
    logger.error({ err: err.message }, '[Team C] WAL recovery failed on startup');
  }

  // 2. Auto-seed if database is empty or SEED_ON_START=true
  try {
    const storage = StorageManager.getInstance();
    const studentCount = storage.getTable('students').getAllRecords().length;
    const driveCount = storage.getTable('drives').getAllRecords().length;

    if (process.env.SEED_ON_START === 'true' || (studentCount === 0 && driveCount === 0)) {
      const seedResult = seedDatabase(storage);
      logger.info(
        { studentsCount: seedResult.studentsCount, drivesCount: seedResult.drivesCount },
        '[Team C] Auto-seeded master data from fixtures'
      );
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[Team C] Auto-seed check failed');
  }

  // 3. Demo User Accounts Seed
  try {
    const seeded = await UserService.getInstance().seedDefaultUsers();
    if (seeded > 0) {
      logger.info({ count: seeded }, '[Team C] Initialized demo user accounts');
    }
  } catch (err: any) {
    logger.error({ err: err.message }, '[Team C] Failed to seed default users');
  }
});

// 4. Graceful Shutdown
let isShuttingDown = false;
const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, '[Team C] Graceful shutdown signal received. Stopping server...');

  server.close(() => {
    logger.info('[Team C] HTTP server closed. Flushing WAL and checkpointing tables...');
    try {
      const storage = StorageManager.getInstance();
      storage.saveAllTables();

      const walWriter = new WalWriter();
      walWriter.writeCheckpoint(walWriter.getCurrentLsn());
      logger.info('[Team C] Final checkpoint persisted. Clean exit.');
    } catch (err: any) {
      logger.error({ err: err.message }, '[Team C] Error persisting checkpoint during shutdown');
    }
    process.exit(0);
  });

  // Force exit if hanging after 10 seconds
  setTimeout(() => {
    logger.fatal('[Team C] Forced exit due to shutdown timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server };
