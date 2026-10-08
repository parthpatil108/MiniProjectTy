import { describe, test, expect, beforeEach } from '@jest/globals';
import { StorageManager } from '../../src/storage/storageManager.js';
import { BaseRecord } from '../../src/storage/table.js';

interface StudentRecord extends BaseRecord {
  student_id: string;
  name: string;
  cgpa: number;
  branch?: string;
  backlogs?: number;
  attendance?: number;
  skill_tags?: string[];
}

describe('M1 - Storage Manager Unit Tests', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    StorageManager.resetInstance();
    storageManager = StorageManager.getInstance();
    storageManager.clearAllTables();
  });

  test('insert, getById, update, and delete maintain records and indexes incrementally', () => {
    // Insert student
    const student = storageManager.insert<StudentRecord>('students', {
      student_id: 'STU-101',
      name: 'Alice',
      cgpa: 9.2,
      branch: 'CSE',
      backlogs: 0,
      attendance: 95.0,
      skill_tags: ['Node.js'],
    });

    expect(student.student_id).toBe('STU-101');
    expect(student._version).toBe(1);

    // Fetch by ID using hash index
    const fetched = storageManager.getById<StudentRecord>('students', 'STU-101');
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe('Alice');

    // Update student with optimistic concurrency version check
    const updated = storageManager.update<StudentRecord>('students', 'STU-101', { cgpa: 9.5 }, 1);
    expect(updated._version).toBe(2);
    expect(updated.cgpa).toBe(9.5);

    // Attempt update with stale version throws VERSION_MISMATCH
    expect(() => {
      storageManager.update<StudentRecord>('students', 'STU-101', { cgpa: 9.8 }, 1);
    }).toThrow(/Version mismatch/);

    // Delete student
    const deleted = storageManager.delete('students', 'STU-101');
    expect(deleted).toBe(true);
    expect(storageManager.getById('students', 'STU-101')).toBeUndefined();
  });

  test('queries utilize Hash and B+Tree indexes based on index configuration', () => {
    // Insert multiple students
    storageManager.insert<StudentRecord>('students', { student_id: 'S1', name: 'S1', cgpa: 7.5 });
    storageManager.insert<StudentRecord>('students', { student_id: 'S2', name: 'S2', cgpa: 8.5 });
    storageManager.insert<StudentRecord>('students', { student_id: 'S3', name: 'S3', cgpa: 9.5 });

    // Hash index exact query on student_id
    const hashQueryResult = storageManager.query<StudentRecord>('students', {
      filter: { student_id: 'S2' },
    });
    expect(hashQueryResult.usedIndex).toBe(true);
    expect(hashQueryResult.indexName).toContain('hash');
    expect(hashQueryResult.records.length).toBe(1);
    expect(hashQueryResult.records[0].student_id).toBe('S2');

    // B+Tree index range query on cgpa
    const rangeQueryResult = storageManager.query<StudentRecord>('students', {
      range: { field: 'cgpa', low: 8.0, high: 10.0 },
    });
    expect(rangeQueryResult.usedIndex).toBe(true);
    expect(rangeQueryResult.indexName).toContain('bplustree');
    expect(rangeQueryResult.records.length).toBe(2);

    // Unindexed field query falls back to table scan
    const unindexedQueryResult = storageManager.query<StudentRecord>('students', {
      filter: { name: 'S3' },
    });
    expect(unindexedQueryResult.usedIndex).toBe(false);
    expect(unindexedQueryResult.records.length).toBe(1);
  });
});
