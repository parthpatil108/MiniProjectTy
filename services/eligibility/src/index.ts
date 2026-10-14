import { createApp } from './app';
import { config } from './config/env';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[Team A] Eligibility Rule Engine listening on port ${config.port}`);
  console.log(`[Team A] API Version: ${config.apiVersion}`);
});

process.on('SIGTERM', () => {
  console.log('[Team A] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
