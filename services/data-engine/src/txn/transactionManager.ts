import { v4 as uuidv4 } from 'uuid';
import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';
import { WalWriter } from '../storage/wal/walWriter.js';
import { LockManager } from '../concurrency/lockManager.js';

export type TxnStatus = 'ACTIVE' | 'COMMITTED' | 'ABORTED';

export interface StagedWrite {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  beforeState: any;
  afterState: any;
  expectedVersion?: number;
}

export interface TransactionContext {
  txnId: string;
  status: TxnStatus;
  stagedWrites: StagedWrite[];
  startTime: string;
}

export class TransactionManager {
  private static instance: TransactionManager | null = null;
  private storageManager: StorageManager;
  private walWriter: WalWriter;
  private lockManager: LockManager;
  private activeTxns: Map<string, TransactionContext> = new Map();

  constructor(
    storageManager?: StorageManager,
    walWriter?: WalWriter,
    lockManager?: LockManager
  ) {
    this.storageManager = storageManager || StorageManager.getInstance();
    this.walWriter = walWriter || new WalWriter();
    this.lockManager = lockManager || new LockManager();
  }

  public static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  public static resetInstance(): void {
    TransactionManager.instance = null;
  }

  public getLockManager(): LockManager {
    return this.lockManager;
  }

  public getWalWriter(): WalWriter {
    return this.walWriter;
  }

  public beginTransaction(): TransactionContext {
    const txnId = `txn_${uuidv4()}`;
    const txnCtx: TransactionContext = {
      txnId,
      status: 'ACTIVE',
      stagedWrites: [],
      startTime: new Date().toISOString(),
    };
    this.activeTxns.set(txnId, txnCtx);
    return txnCtx;
  }

  public async read<T extends BaseRecord = BaseRecord>(
    tableName: string,
    id: string,
    txn: TransactionContext
  ): Promise<T | undefined> {
    this.ensureActive(txn);

    // Acquire Shared lock per strict 2PL
    await this.lockManager.acquireLock(txn.txnId, tableName, id, 'S');

    // Check if staged in local transaction memory
    for (let i = txn.stagedWrites.length - 1; i >= 0; i--) {
      const sw = txn.stagedWrites[i];
      if (sw.tableName === tableName && sw.recordId === id) {
        if (sw.action === 'DELETE') return undefined;
        return sw.afterState as T;
      }
    }

    return this.storageManager.getById<T>(tableName, id);
  }

  public async write<T extends BaseRecord = BaseRecord>(
    tableName: string,
    id: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    data: Partial<T>,
    expectedVersion?: number,
    txn?: TransactionContext
  ): Promise<T | null> {
    if (!txn) {
      // Auto-commit single operation if no txn provided
      const autoTxn = this.beginTransaction();
      try {
        const res = await this.write<T>(tableName, id, action, data, expectedVersion, autoTxn);
        await this.commit(autoTxn);
        return res;
      } catch (err) {
        await this.rollback(autoTxn);
        throw err;
      }
    }

    this.ensureActive(txn);

    // Acquire Exclusive lock per strict 2PL
    await this.lockManager.acquireLock(txn.txnId, tableName, id, 'X');

    // Determine current record state
    const existing = await this.read<T>(tableName, id, txn);

    let beforeState: any = existing ? { ...existing } : null;
    let afterState: any = null;

    if (action === 'INSERT') {
      const now = new Date().toISOString();
      afterState = {
        ...data,
        _id: id,
        _version: 1,
        _createdAt: now,
        _updatedAt: now,
      };
    } else if (action === 'UPDATE') {
      if (!existing) {
        const err: any = new Error(`Record ${id} not found in ${tableName}`);
        err.code = 'NOT_FOUND';
        throw err;
      }
      if (expectedVersion !== undefined && existing._version !== expectedVersion) {
        const err: any = new Error(
          `Version mismatch for ${tableName} [${id}]: expected ${expectedVersion}, got ${existing._version}`
        );
        err.code = 'VERSION_MISMATCH';
        throw err;
      }

      const now = new Date().toISOString();
      afterState = {
        ...existing,
        ...data,
        _id: id,
        _version: (existing._version || 1) + 1,
        _updatedAt: now,
      };
    } else if (action === 'DELETE') {
      if (!existing) {
        const err: any = new Error(`Record ${id} not found in ${tableName}`);
        err.code = 'NOT_FOUND';
        throw err;
      }
      afterState = null;
    }

    // Stage write in transaction memory
    txn.stagedWrites.push({
      tableName,
      recordId: id,
      action,
      beforeState,
      afterState,
      expectedVersion,
    });

    return afterState as T;
  }

  public async commit(txn: TransactionContext): Promise<void> {
    this.ensureActive(txn);

    try {
      // 1. Log BEGIN to WAL if transaction had staged writes
      if (txn.stagedWrites.length > 0) {
        this.walWriter.logBegin(txn.txnId);

        // 2. Append all WRITE records to WAL
        for (const sw of txn.stagedWrites) {
          this.walWriter.logWrite(
            txn.txnId,
            sw.tableName,
            sw.action,
            sw.recordId,
            sw.beforeState,
            sw.afterState,
            sw.expectedVersion
          );
        }

        // 3. Append COMMIT to WAL and flush to disk
        this.walWriter.logCommit(txn.txnId);

        // 4. Apply changes in-memory to StorageManager
        for (const sw of txn.stagedWrites) {
          if (sw.action === 'INSERT') {
            this.storageManager.insert(sw.tableName, sw.afterState);
          } else if (sw.action === 'UPDATE') {
            this.storageManager.update(
              sw.tableName,
              sw.recordId,
              sw.afterState,
              sw.expectedVersion
            );
          } else if (sw.action === 'DELETE') {
            this.storageManager.delete(sw.tableName, sw.recordId);
          }
        }
      }

      txn.status = 'COMMITTED';
    } finally {
      // 5. Release all locks held by transaction
      this.lockManager.releaseLocks(txn.txnId);
      this.activeTxns.delete(txn.txnId);
    }
  }

  public async rollback(txn: TransactionContext): Promise<void> {
    if (txn.status !== 'ACTIVE') return;

    try {
      if (txn.stagedWrites.length > 0) {
        this.walWriter.logAbort(txn.txnId);
      }
      txn.status = 'ABORTED';
    } finally {
      this.lockManager.releaseLocks(txn.txnId);
      this.activeTxns.delete(txn.txnId);
    }
  }

  private ensureActive(txn: TransactionContext): void {
    if (txn.status !== 'ACTIVE') {
      throw new Error(`Transaction ${txn.txnId} is not ACTIVE (current status: ${txn.status})`);
    }
  }

  public clear(): void {
    this.activeTxns.clear();
    this.lockManager.clear();
  }
}
