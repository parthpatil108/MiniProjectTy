import { indexConfig } from '../config/indexConfig.js';
import { StorageTable, BaseRecord, QueryOptions, QueryResult } from './table.js';

export class StorageManager {
  private static instance: StorageManager | null = null;
  private tables: Map<string, StorageTable<any>> = new Map();

  constructor() {
    this.initTables();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public static resetInstance(): void {
    StorageManager.instance = null;
  }

  private initTables(): void {
    const pkMapping: Record<string, string> = {
      applications: 'application_id',
      students: 'student_id',
      drives: 'drive_id',
    };

    for (const [tableName, indexSpec] of Object.entries(indexConfig)) {
      const pkField = pkMapping[tableName] || 'id';
      this.tables.set(tableName, new StorageTable(tableName, indexSpec, pkField));
    }
  }

  public getTable<T extends BaseRecord = BaseRecord>(tableName: string): StorageTable<T> {
    const table = this.tables.get(tableName);
    if (!table) {
      // Lazily create table if not in config
      const newTable = new StorageTable<T>(tableName, { hash: [], bplustree: [] }, 'id');
      this.tables.set(tableName, newTable);
      return newTable;
    }
    return table;
  }

  public insert<T extends BaseRecord = BaseRecord>(tableName: string, record: T): T {
    return this.getTable<T>(tableName).insert(record);
  }

  public update<T extends BaseRecord = BaseRecord>(
    tableName: string,
    id: string,
    patch: Partial<T>,
    expectedVersion?: number
  ): T {
    return this.getTable<T>(tableName).update(id, patch, expectedVersion);
  }

  public delete(tableName: string, id: string): boolean {
    return this.getTable(tableName).delete(id);
  }

  public getById<T extends BaseRecord = BaseRecord>(tableName: string, id: string): T | undefined {
    return this.getTable<T>(tableName).getById(id);
  }

  public query<T extends BaseRecord = BaseRecord>(
    tableName: string,
    options: QueryOptions
  ): QueryResult<T> {
    return this.getTable<T>(tableName).query(options);
  }

  public clearAllTables(): void {
    for (const table of this.tables.values()) {
      table.clear();
    }
  }
}
