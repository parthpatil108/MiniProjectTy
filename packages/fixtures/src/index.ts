import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for ES module dirname
let fixturesDir: string;
try {
  const __filename = fileURLToPath(import.meta.url);
  fixturesDir = path.dirname(__filename);
} catch {
  fixturesDir = __dirname;
}

export function getStudentsFixture(): any[] {
  const filePath = path.join(fixturesDir, 'students.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getDrivesFixture(): any[] {
  const filePath = path.join(fixturesDir, 'drives.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
