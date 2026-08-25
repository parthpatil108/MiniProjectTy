import fs from 'fs';
import path from 'path';
import { StorageManager } from '../../src/storage/storageManager.js';
import { WalWriter } from '../../src/storage/wal/walWriter.js';
import { WalRecovery } from '../../src/storage/wal/recovery.ts';

describe('M2 - WAL & Recovery Unit Tests', () => {
  const testDataDir = path.join(process.cwd(), 'data_test_wal');
  let walWriter: WalWriter;

  beforeEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });
    walWriter = new WalWriter(testDataDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  test('simulates crash mid-write: recovery applies committed txns and discards uncommitted txns', () => {
    // 1. Transaction 1 (Committed)
    walWriter.logBegin('txn_committed');
    walWriter.logWrite('txn_committed', 'students', 'INSERT', 'S1', null, {
      student_id: 'S1',
      name: 'Committed Student',
      cgpa: 9.0,
      _version: 1,
    });
    walWriter.logCommit('txn_committed');

    // 2. Transaction 2 (Crashed mid-write before COMMIT record!)
    walWriter.logBegin('txn_crashed');
    walWriter.logWrite('txn_crashed', 'students', 'INSERT', 'S2', null, {
      student_id: 'S2',
      name: 'Uncommitted Crashed Student',
      cgpa: 5.0,
      _version: 1,
    });

    // Reset storage manager to clean in-memory state
    StorageManager.resetInstance();
    const storageManager = StorageManager.getInstance();
    storageManager.clearAllTables();

    // Verify in-memory DB has 0 records before recovery
    expect(storageManager.getById('students', 'S1')).toBeUndefined();
    expect(storageManager.getById('students', 'S2')).toBeUndefined();

    // Run Recovery
    const recovery = new WalRecovery(walWriter, storageManager);
    const report = recovery.recover();

    expect(report.status).toBe('OK');
    expect(report.committedTxnCount).toBe(1);
    expect(report.ignoredTxnCount).toBe(1);

    // Verify committed transaction S1 IS present
    const s1 = storageManager.getById('students', 'S1');
    expect(s1).toBeDefined();
    expect(s1?.name).toBe('Committed Student');

    // Verify uncommitted transaction S2 IS DISCARDED (not present)
    const s2 = storageManager.getById('students', 'S2');
    expect(s2).toBeUndefined();
  });
});
