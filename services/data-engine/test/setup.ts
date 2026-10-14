import fs from 'fs';
import path from 'path';
import os from 'os';

const testDataDir = path.join(os.tmpdir(), `apnileap-test-data-${process.pid}`);
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}
process.env.DATA_DIR = testDataDir;

afterAll(() => {
  try {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup errors on Windows locks
  }
});
