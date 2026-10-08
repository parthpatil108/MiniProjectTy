import fs from 'fs';
import path from 'path';
import { indexConfig } from '../config/indexConfig.js';
import { StorageTable, BaseRecord, QueryOptions, QueryResult } from './table.js';

export class StorageManager {
  private static instance: StorageManager | null = null;
  private tables: Map<string, StorageTable<any>> = new Map();
  private dataDir: string;

  constructor(dataDir: string = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.initTables();
    this.loadAllTables();
  }

  public static getInstance(dataDir?: string): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager(dataDir);
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

  public loadAllTables(): void {
    for (const table of this.tables.values()) {
      table.loadFromFile(this.dataDir);
    }
  }

  public saveAllTables(targetDir: string = this.dataDir): void {
    for (const table of this.tables.values()) {
      table.saveToFile(targetDir);
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
    const result = this.getTable<T>(tableName).insert(record);
    this.saveAllTables();
    return result;
  }

  public update<T extends BaseRecord = BaseRecord>(
    tableName: string,
    id: string,
    patch: Record<string, any>,
    expectedVersion?: number
  ): T {
    const result = this.getTable<T>(tableName).update(id, patch as Partial<T>, expectedVersion);
    this.saveAllTables();
    return result;
  }

  public delete(tableName: string, id: string): boolean {
    const result = this.getTable(tableName).delete(id);
    this.saveAllTables();
    return result;
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
