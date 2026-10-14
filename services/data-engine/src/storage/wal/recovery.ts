import { StorageManager } from '../storageManager.js';
import { WalWriter, WalRecord } from './walWriter.js';

export interface RecoveryReport {
  status: string;
  lastCheckpointLsn: number;
  replayedCount: number;
  committedTxnCount: number;
  ignoredTxnCount: number;
  walBacklog: number;
}

export class WalRecovery {
  private walWriter: WalWriter;
  private storageManager: StorageManager;

  constructor(walWriter?: WalWriter, storageManager?: StorageManager) {
    this.walWriter = walWriter || new WalWriter();
    this.storageManager = storageManager || StorageManager.getInstance();
  }

  /**
   * Replays WAL log file from last checkpoint, applying committed transactions to StorageManager.
   */
  public recover(): RecoveryReport {
    const { checkpointLsn, records } = this.walWriter.readLogsAfterCheckpoint();

    // 1. Identify all committed transaction IDs
    const committedTxns = new Set<string>();
    const abortedTxns = new Set<string>();
    const allTxns = new Set<string>();

    for (const record of records) {
      allTxns.add(record.txnId);
      if (record.type === 'COMMIT') {
        committedTxns.add(record.txnId);
      } else if (record.type === 'ABORT') {
        abortedTxns.add(record.txnId);
      }
    }

    let replayedCount = 0;
    let maxReplayedLsn = checkpointLsn;

    // 2. Replay WRITE records of committed transactions in LSN order
    for (const record of records) {
      if (record.type === 'WRITE' && record.tableName && committedTxns.has(record.txnId)) {
        const { tableName, action, afterState, recordId, expectedVersion } = record;

        if (action === 'INSERT' && afterState) {
          this.storageManager.insert(tableName, afterState);
        } else if (action === 'UPDATE' && recordId && afterState) {
          try {
            this.storageManager.update(tableName, recordId, afterState, expectedVersion);
          } catch (err) {
            // Force update if version check fails during recovery replay
            this.storageManager.getTable(tableName).insert(afterState);
          }
        } else if (action === 'DELETE' && recordId) {
          this.storageManager.delete(tableName, recordId);
        }

        replayedCount++;
        maxReplayedLsn = Math.max(maxReplayedLsn, record.lsn);
      }
    }

    // 3. Write new checkpoint
    this.walWriter.writeCheckpoint(maxReplayedLsn);

    const ignoredTxnCount = allTxns.size - committedTxns.size;

    return {
      status: 'OK',
      lastCheckpointLsn: maxReplayedLsn,
      replayedCount,
      committedTxnCount: committedTxns.size,
      ignoredTxnCount,
      walBacklog: 0,
    };
  }
}
