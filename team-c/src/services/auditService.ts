import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEntry {
  audit_id: string;
  actor: string;
  action: string;
  entity_id: string;
  before_state?: any;
  after_state?: any;
  timestamp: string;
  correlation_id: string;
}

export interface AuditQueryOptions {
  correlation_id?: string;
  entity_id?: string;
  from?: string;
  to?: string;
}

export class AuditService {
  private customStorageManager?: StorageManager;

  constructor(storageManager?: StorageManager) {
    this.customStorageManager = storageManager;
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public recordAudit(entry: Partial<AuditEntry>): AuditEntry {
    const auditRecord: AuditEntry = {
      audit_id: entry.audit_id || `aud_${uuidv4().substring(0, 8)}`,
      actor: entry.actor || 'SYSTEM',
      action: entry.action || 'MUTATION',
      entity_id: entry.entity_id || 'UNKNOWN',
      before_state: entry.before_state || null,
      after_state: entry.after_state || null,
      timestamp: entry.timestamp || new Date().toISOString(),
      correlation_id: entry.correlation_id || '00000000-0000-0000-0000-000000000000',
    };

    this.getStorageManager().insert<BaseRecord>('audit', {
      ...auditRecord,
      _id: auditRecord.audit_id,
    });

    return auditRecord;
  }

  public searchAudit(options: AuditQueryOptions): AuditEntry[] {
    const storage = this.getStorageManager();
    const result = storage.query('audit', {});
    let entries = result.records as unknown as AuditEntry[];

    if (options.correlation_id) {
      entries = entries.filter((e) => e.correlation_id === options.correlation_id);
    }
    if (options.entity_id) {
      entries = entries.filter((e) => e.entity_id === options.entity_id);
    }
    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      entries = entries.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }
    if (options.to) {
      const toTime = new Date(options.to).getTime();
      entries = entries.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }

    // Newest first
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}
