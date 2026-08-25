import { WaitForGraph } from './waitForGraph.js';

export type LockMode = 'S' | 'X';

export interface LockWaiter {
  txnId: string;
  mode: LockMode;
  resolve: () => void;
  reject: (err: any) => void;
  timeoutTimer?: NodeJS.Timeout;
}

export interface LockRecord {
  grantedMode: LockMode | null;
  holders: Set<string>;
  waiters: LockWaiter[];
}

export class LockManager {
  private locks: Map<string, LockRecord> = new Map();
  private waitForGraph: WaitForGraph = new WaitForGraph();

  public getLockKey(tableName: string, recordId: string): string {
    return `${tableName}:${recordId}`;
  }

  public getWaitForGraph(): WaitForGraph {
    return this.waitForGraph;
  }

  /**
   * Acquire a Shared ('S') or Exclusive ('X') lock for a transaction on a record.
   */
  public async acquireLock(
    txnId: string,
    tableName: string,
    recordId: string,
    mode: LockMode,
    timeoutMs: number = 2000
  ): Promise<void> {
    const lockKey = this.getLockKey(tableName, recordId);

    if (!this.locks.has(lockKey)) {
      this.locks.set(lockKey, {
        grantedMode: null,
        holders: new Set(),
        waiters: [],
      });
    }

    const lock = this.locks.get(lockKey)!;

    // Check if txn already holds Exclusive lock or requested S lock when already holding S
    if (lock.holders.has(txnId)) {
      if (lock.grantedMode === 'X' || mode === 'S') {
        return; // Already held
      }
    }

    // Check compatibility:
    // Can grant immediately if:
    // 1. Lock has no holders
    // 2. Txn is the ONLY holder (upgrading from S to X)
    // 3. Requesting 'S', grantedMode is 'S', and no waiting 'X' locks
    const isCompatible =
      lock.holders.size === 0 ||
      (lock.holders.size === 1 && lock.holders.has(txnId)) ||
      (mode === 'S' &&
        lock.grantedMode === 'S' &&
        lock.waiters.filter((w) => w.mode === 'X').length === 0);

    if (isCompatible) {
      lock.grantedMode = mode;
      lock.holders.clear();
      lock.holders.add(txnId);
      return;
    }

    // Incompatible: must wait. Add dependencies to Wait-For Graph
    let cycleDetected = false;
    for (const holder of lock.holders) {
      if (holder !== txnId) {
        if (this.waitForGraph.addEdge(txnId, holder)) {
          cycleDetected = true;
          break;
        }
      }
    }

    if (cycleDetected) {
      const err: any = new Error(
        `Deadlock cycle detected for transaction ${txnId} waiting on ${lockKey}`
      );
      err.code = 'LOCK_TIMEOUT';
      throw err;
    }

    // Wait asynchronously for lock
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = lock.waiters.findIndex((w) => w.txnId === txnId);
        if (idx !== -1) {
          lock.waiters.splice(idx, 1);
        }
        this.waitForGraph.removeTxn(txnId);

        const err: any = new Error(
          `Lock acquisition timed out (${timeoutMs}ms) for txn ${txnId} on ${lockKey}`
        );
        err.code = 'LOCK_TIMEOUT';
        reject(err);
      }, timeoutMs);

      lock.waiters.push({
        txnId,
        mode,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err: any) => {
          clearTimeout(timer);
          reject(err);
        },
        timeoutTimer: timer,
      });
    });
  }

  /**
   * Release all locks held or waited on by a transaction.
   */
  public releaseLocks(txnId: string): void {
    this.waitForGraph.removeTxn(txnId);

    for (const [lockKey, lock] of this.locks.entries()) {
      if (lock.holders.has(txnId)) {
        lock.holders.delete(txnId);
        if (lock.holders.size === 0) {
          lock.grantedMode = null;
        }
      }

      const waiterIdx = lock.waiters.findIndex((w) => w.txnId === txnId);
      if (waiterIdx !== -1) {
        const [waiter] = lock.waiters.splice(waiterIdx, 1);
        if (waiter.timeoutTimer) {
          clearTimeout(waiter.timeoutTimer);
        }
      }

      this.processWaiters(lockKey, lock);
    }
  }

  private processWaiters(lockKey: string, lock: LockRecord): void {
    if (lock.waiters.length === 0) return;

    const firstWaiter = lock.waiters[0];
    const canGrantHead =
      lock.holders.size === 0 ||
      (lock.holders.size === 1 && lock.holders.has(firstWaiter.txnId));

    if (canGrantHead) {
      if (firstWaiter.mode === 'X') {
        const waiter = lock.waiters.shift()!;
        lock.grantedMode = 'X';
        lock.holders.clear();
        lock.holders.add(waiter.txnId);
        this.waitForGraph.removeTxn(waiter.txnId);
        waiter.resolve();
      } else {
        lock.grantedMode = 'S';
        while (lock.waiters.length > 0 && lock.waiters[0].mode === 'S') {
          const waiter = lock.waiters.shift()!;
          lock.holders.add(waiter.txnId);
          this.waitForGraph.removeTxn(waiter.txnId);
          waiter.resolve();
        }
      }
    } else if (lock.grantedMode === 'S') {
      while (
        lock.waiters.length > 0 &&
        lock.waiters[0].mode === 'S'
      ) {
        const waiter = lock.waiters.shift()!;
        lock.holders.add(waiter.txnId);
        this.waitForGraph.removeTxn(waiter.txnId);
        waiter.resolve();
      }
    }
  }

  public clear(): void {
    this.locks.clear();
    this.waitForGraph.clear();
  }
}
