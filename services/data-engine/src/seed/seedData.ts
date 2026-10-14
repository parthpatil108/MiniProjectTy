import { StorageManager } from '../storage/storageManager.js';
import { getStudentsFixture, getDrivesFixture } from '@apnileap/fixtures';

export function seedDatabase(storageManager?: StorageManager): { studentsCount: number; drivesCount: number } {
  const storage = storageManager || StorageManager.getInstance();
  const students = getStudentsFixture();
  const drives = getDrivesFixture();

  for (const s of students) {
    storage.insert('students', s);
  }

  for (const d of drives) {
    storage.insert('drives', d);
  }

  storage.saveAllTables();
  return { studentsCount: students.length, drivesCount: drives.length };
}

if (process.argv[1] && process.argv[1].includes('seedData')) {
  const result = seedDatabase();
  console.log(`Seeded ${result.studentsCount} students and ${result.drivesCount} drives successfully from @apnileap/fixtures.`);
}
