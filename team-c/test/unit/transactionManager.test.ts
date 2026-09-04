import { describe, test, expect, beforeEach } from '@jest/globals';
import { TransactionManager } from '../../src/txn/transactionManager.js';
import { StorageManager } from '../../src/storage/storageManager.js';

describe('M2 - Transaction Manager Unit Tests', () => {
  let txnManager: TransactionManager;
  let storageManager: StorageManager;

  beforeEach(() => {
    StorageManager.resetInstance();
    TransactionManager.resetInstance();
    storageManager = StorageManager.getInstance();
    storageManager.clearAllTables();
    txnManager = TransactionManager.getInstance();
  });

  test('transaction commit atomically applies all staged writes to storage', async () => {
    const txn = txnManager.beginTransaction();

    await txnManager.write('students', 'STU-201', 'INSERT', {
      student_id: 'STU-201',
      name: 'Bob',
      cgpa: 8.2,
    }, undefined, txn);

    await txnManager.write('drives', 'DRV-501', 'INSERT', {
      drive_id: 'DRV-501',
      company: 'TechCorp',
      seats: 5,
    }, undefined, txn);

    // Uncommitted state is NOT visible in storage manager directly
    expect(storageManager.getById('students', 'STU-201')).toBeUndefined();
    expect(storageManager.getById('drives', 'DRV-501')).toBeUndefined();

    // Within transaction, reads return staged uncommitted state
    const readStaged = await txnManager.read('students', 'STU-201', txn);
    expect(readStaged).toBeDefined();
    expect(readStaged?.name).toBe('Bob');

    // Commit transaction
    await txnManager.commit(txn);

    // After commit, changes are permanently applied to storage manager
    expect(storageManager.getById('students', 'STU-201')).toBeDefined();
    expect(storageManager.getById('drives', 'DRV-501')).toBeDefined();
  });

  test('transaction rollback discards all staged writes and releases locks', async () => {
    const txn = txnManager.beginTransaction();

    await txnManager.write('students', 'STU-202', 'INSERT', {
      student_id: 'STU-202',
      name: 'Charlie',
      cgpa: 7.8,
    }, undefined, txn);

    await txnManager.rollback(txn);

    // After rollback, storage remains untouched
    expect(storageManager.getById('students', 'STU-202')).toBeUndefined();
  });

  test('strict 2PL enforces serializable isolation between concurrent transactions', async () => {
    // Insert initial drive record
    storageManager.insert('drives', {
      drive_id: 'DRV-999',
      company: 'InnovateInc',
      seats: 10,
      _version: 1,
    });

    const txn1 = txnManager.beginTransaction();
    const txn2 = txnManager.beginTransaction();

    // Txn1 acquires Exclusive lock on DRV-999
    await txnManager.write('drives', 'DRV-999', 'UPDATE', { seats: 9 }, 1, txn1);

    let txn2Finished = false;

    // Txn2 attempts to write to DRV-999 -> blocked by Txn1's X lock
    const txn2Promise = txnManager
      .write('drives', 'DRV-999', 'UPDATE', { seats: 8 }, 1, txn2)
      .then(async () => {
        await txnManager.commit(txn2);
        txn2Finished = true;
      });

    await new Promise((r) => setTimeout(r, 50));
    expect(txn2Finished).toBe(false);

    // Txn1 commits, releasing locks
    await txnManager.commit(txn1);

    // Now Txn2 can proceed (though expectedVersion 1 fails as version is now 2)
    await expect(txn2Promise).rejects.toThrow(/Version mismatch/);
    await txnManager.rollback(txn2);
  });
});
