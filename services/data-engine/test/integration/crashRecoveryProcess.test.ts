import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fork } from 'child_process';
import { StorageManager } from '../../src/storage/storageManager.js';
import { WalWriter } from '../../src/storage/wal/walWriter.js';
import { WalRecovery } from '../../src/storage/wal/recovery.js';

describe('Crash Recovery & Process Kill Resilience', () => {
  let crashDataDir: string;

  beforeEach(() => {
    crashDataDir = path.join(os.tmpdir(), `apnileap-crash-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    if (!fs.existsSync(crashDataDir)) {
      fs.mkdirSync(crashDataDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(crashDataDir)) {
        fs.rmSync(crashDataDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  test('simulating sudden process kill mid-write: recovery preserves all committed data and discards uncommitted data', () => {
    const walWriter = new WalWriter(crashDataDir);

    // 1. Transaction 1: Completely committed
    walWriter.logBegin('txn_valid_commit');
    walWriter.logWrite('txn_valid_commit', 'students', 'INSERT', 'STU-COMMITTED', null, {
      student_id: 'STU-COMMITTED',
      name: 'Committed Student A',
      cgpa: 9.1,
      _version: 1
    });
    walWriter.logCommit('txn_valid_commit');

    // 2. Transaction 2: Mid-write crash! (Process terminated before logCommit)
    walWriter.logBegin('txn_crash_midway');
    walWriter.logWrite('txn_crash_midway', 'students', 'INSERT', 'STU-GHOST', null, {
      student_id: 'STU-GHOST',
      name: 'Phantom Uncommitted Student',
      cgpa: 4.0,
      _version: 1
    });
    // NO logCommit! Sudden termination!

    // 3. Restart / Re-instantiate clean storage manager from crashDataDir
    StorageManager.resetInstance();
    const freshStorage = StorageManager.getInstance(crashDataDir);
    freshStorage.clearAllTables();

    expect(freshStorage.getById('students', 'STU-COMMITTED')).toBeUndefined();
    expect(freshStorage.getById('students', 'STU-GHOST')).toBeUndefined();

    // 4. Run WAL Recovery
    const recovery = new WalRecovery(new WalWriter(crashDataDir), freshStorage);
    const report = recovery.recover();

    expect(report.status).toBe('OK');
    expect(report.committedTxnCount).toBe(1);

    // 5. Verify committed record is restored and uncommitted record is absent
    const committedStudent = freshStorage.getById('students', 'STU-COMMITTED');
    expect(committedStudent).toBeDefined();
    expect(committedStudent?.name).toBe('Committed Student A');

    const ghostStudent = freshStorage.getById('students', 'STU-GHOST');
    expect(ghostStudent).toBeUndefined();
  });
});
