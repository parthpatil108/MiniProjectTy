import dotenv from 'dotenv';
import { app } from './app.js';
import { UserService } from './services/userService.js';
import { loadConfig } from '@apnileap/common';

dotenv.config();
const config = loadConfig();

const PORT = config.DATA_ENGINE_PORT || 3003;

app.listen(PORT, async () => {
  console.log(`Team C Data & Transaction Manager listening on port ${PORT}`);
  try {
    const seeded = await UserService.getInstance().seedDefaultUsers();
    if (seeded > 0) {
      console.log(`[Team C] Initialized ${seeded} default demo user accounts.`);
    }
  } catch (err: any) {
    console.error('[Team C] Failed to seed default users:', err.message);
  }
});
