import fs from 'fs';
import path from 'path';

export interface WalRecord {
  lsn: number;
  txnId: string;
  type: 'BEGIN' | 'WRITE' | 'COMMIT' | 'ABORT';
  tableName?: string;
  recordId?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  beforeState?: any;
  afterState?: any;
  expectedVersion?: number;
  timestamp: string;
}

export class WalWriter {
  private walFilePath: string;
  private checkpointFilePath: string;
  private currentLsn: number = 0;

  constructor(dataDir: string = path.join(process.cwd(), 'data')) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.walFilePath = path.join(dataDir, 'wal.log');
    this.checkpointFilePath = path.join(dataDir, 'wal.checkpoint');
    this.initLsn();
  }

  private initLsn(): void {
    if (fs.existsSync(this.checkpointFilePath)) {
      try {
        const content = fs.readFileSync(this.checkpointFilePath, 'utf-8').trim();
        if (content) {
          this.currentLsn = parseInt(content, 10) || 0;
        }
      } catch (err) {
        this.currentLsn = 0;
      }
    }

    if (fs.existsSync(this.walFilePath)) {
      try {
        const lines = fs.readFileSync(this.walFilePath, 'utf-8').split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const rec: WalRecord = JSON.parse(line);
          if (rec.lsn > this.currentLsn) {
            this.currentLsn = rec.lsn;
          }
        }
      } catch (err) {
        // Ignored
      }
    }
  }

  public getNextLsn(): number {
    this.currentLsn += 1;
    return this.currentLsn;
  }

  public getCurrentLsn(): number {
    return this.currentLsn;
  }

  public logBegin(txnId: string): number {
    const lsn = this.getNextLsn();
    const record: WalRecord = {
      lsn,
      txnId,
      type: 'BEGIN',
      timestamp: new Date().toISOString(),
    };
    this.appendRecord(record);
    return lsn;
  }

  public logWrite(
    txnId: string,
    tableName: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    beforeState: any,
    afterState: any,
    expectedVersion?: number
  ): number {
    const lsn = this.getNextLsn();
    const record: WalRecord = {
      lsn,
      txnId,
      type: 'WRITE',
      tableName,
      recordId,
      action,
      beforeState,
      afterState,
      expectedVersion,
      timestamp: new Date().toISOString(),
    };
    this.appendRecord(record);
    return lsn;
  }

  public logCommit(txnId: string): number {
    const lsn = this.getNextLsn();
    const record: WalRecord = {
      lsn,
      txnId,
      type: 'COMMIT',
      timestamp: new Date().toISOString(),
    };
    this.appendRecord(record, true); // Flush to disk on COMMIT!
    return lsn;
  }

  public logAbort(txnId: string): number {
    const lsn = this.getNextLsn();
    const record: WalRecord = {
      lsn,
      txnId,
      type: 'ABORT',
      timestamp: new Date().toISOString(),
    };
    this.appendRecord(record, true);
    return lsn;
  }

  public writeCheckpoint(lsn: number): void {
    fs.writeFileSync(this.checkpointFilePath, lsn.toString(), 'utf-8');
  }

  public readLogsAfterCheckpoint(): { checkpointLsn: number; records: WalRecord[] } {
    let checkpointLsn = 0;
    if (fs.existsSync(this.checkpointFilePath)) {
      try {
        const content = fs.readFileSync(this.checkpointFilePath, 'utf-8').trim();
        checkpointLsn = parseInt(content, 10) || 0;
      } catch (err) {
        checkpointLsn = 0;
      }
    }

    const records: WalRecord[] = [];
    if (fs.existsSync(this.walFilePath)) {
      const lines = fs.readFileSync(this.walFilePath, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const rec: WalRecord = JSON.parse(line);
          if (rec.lsn > checkpointLsn) {
            records.push(rec);
          }
        } catch (err) {
          // ignore corrupted line
        }
      }
    }

    return { checkpointLsn, records };
  }

  private appendRecord(record: WalRecord, sync: boolean = false): void {
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(this.walFilePath, line, 'utf-8');
    if (sync) {
      const fd = fs.openSync(this.walFilePath, 'r+');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    }
  }

  public clearLogs(): void {
    if (fs.existsSync(this.walFilePath)) {
      fs.writeFileSync(this.walFilePath, '', 'utf-8');
    }
    if (fs.existsSync(this.checkpointFilePath)) {
      fs.writeFileSync(this.checkpointFilePath, '0', 'utf-8');
    }
    this.currentLsn = 0;
  }
}
