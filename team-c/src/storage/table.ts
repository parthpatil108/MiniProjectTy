import { v4 as uuidv4 } from 'uuid';
import { HashIndex } from './indexes/hashIndex.js';
import { BPlusTree } from './indexes/bplustree.js';
import { TableIndexSpec } from '../config/indexConfig.js';

export interface BaseRecord {
  _id?: string;
  _version?: number;
  _createdAt?: string;
  _updatedAt?: string;
  [key: string]: any;
}

export interface QueryOptions {
  filter?: Record<string, any>;
  range?: {
    field: string;
    low?: any;
    high?: any;
    lowInclusive?: boolean;
    highInclusive?: boolean;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  limit?: number;
}

export interface QueryResult<T = BaseRecord> {
  records: T[];
  usedIndex: boolean;
  indexName?: string;
}

export class StorageTable<T extends BaseRecord = BaseRecord> {
  private tableName: string;
  private primaryKeyField: string;
  private records: Map<string, T> = new Map(); // Keyed by record ID / domain ID
  private hashIndexes: Map<string, HashIndex<any, string>> = new Map(); // fieldName -> HashIndex (maps fieldVal -> recordId)
  private bplusIndexes: Map<string, BPlusTree<any, string>> = new Map(); // fieldName -> BPlusTree (maps fieldVal -> recordId)

  constructor(tableName: string, indexSpec: TableIndexSpec, primaryKeyField: string) {
    this.tableName = tableName;
    this.primaryKeyField = primaryKeyField;

    // Initialize Hash Indexes
    for (const field of indexSpec.hash) {
      this.hashIndexes.set(field, new HashIndex<any, string>());
    }

    // Initialize B+Tree Indexes
    for (const field of indexSpec.bplustree) {
      this.bplusIndexes.set(field, new BPlusTree<any, string>(4));
    }
  }

  public getTableName(): string {
    return this.tableName;
  }

  public getPrimaryKeyField(): string {
    return this.primaryKeyField;
  }

  public getHashIndex(field: string): HashIndex<any, string> | undefined {
    return this.hashIndexes.get(field);
  }

  public getBPlusTree(field: string): BPlusTree<any, string> | undefined {
    return this.bplusIndexes.get(field);
  }

  public getAllRecords(): T[] {
    return Array.from(this.records.values());
  }

  public insert(record: T): T {
    const id = record[this.primaryKeyField] || record._id || uuidv4();
    const now = new Date().toISOString();

    const newRecord: T = {
      ...record,
      _id: record._id || id,
      [this.primaryKeyField]: id,
      _version: record._version ?? 1,
      _createdAt: record._createdAt || now,
      _updatedAt: record._updatedAt || now,
    };

    // Store in memory
    this.records.set(id, newRecord);

    // Update indexes incrementally
    this.indexRecord(newRecord, id);

    return newRecord;
  }

  public update(id: string, patch: Partial<T>, expectedVersion?: number): T {
    const existing = this.getById(id);
    if (!existing) {
      const err: any = new Error(`Record with ID ${id} not found in ${this.tableName}`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (expectedVersion !== undefined && existing._version !== expectedVersion) {
      const err: any = new Error(
        `Version mismatch for ${this.tableName} [${id}]: expected ${expectedVersion}, got ${existing._version}`
      );
      err.code = 'VERSION_MISMATCH';
      throw err;
    }

    // Unindex old record
    this.unindexRecord(existing, id);

    const now = new Date().toISOString();
    const updatedRecord: T = {
      ...existing,
      ...patch,
      _id: existing._id,
      [this.primaryKeyField]: id,
      _version: (existing._version || 1) + 1,
      _updatedAt: now,
    };

    this.records.set(id, updatedRecord);

    // Re-index updated record
    this.indexRecord(updatedRecord, id);

    return updatedRecord;
  }

  public delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }

    this.unindexRecord(existing, id);
    this.records.delete(id);
    return true;
  }

  public getById(id: string): T | undefined {
    // Try primary key hash index first if available
    const pkHash = this.hashIndexes.get(this.primaryKeyField);
    if (pkHash) {
      const recId = pkHash.get(id);
      if (recId) {
        return this.records.get(recId);
      }
    }
    return this.records.get(id);
  }

  public query(options: QueryOptions): QueryResult<T> {
    const { filter, range, sort, limit } = options;

    // 1. Try Hash Index lookup if exact filter matches an indexed hash field
    if (filter) {
      for (const field of Object.keys(filter)) {
        const hashIdx = this.hashIndexes.get(field);
        if (hashIdx) {
          const val = filter[field];
          const recordId = hashIdx.get(val);
          if (recordId) {
            const rec = this.records.get(recordId);
            if (rec && this.matchesFilter(rec, filter)) {
              return {
                records: [rec],
                usedIndex: true,
                indexName: `hash:${field}`,
              };
            }
          }
          return {
            records: [],
            usedIndex: true,
            indexName: `hash:${field}`,
          };
        }
      }
    }

    // 2. Try B+Tree Index lookup if range query matches an indexed B+Tree field
    if (range) {
      const btreeIdx = this.bplusIndexes.get(range.field);
      if (btreeIdx) {
        const low = range.low ?? -Infinity;
        const high = range.high ?? Infinity;
        const recordIds = btreeIdx.rangeQuery(
          low,
          high,
          range.lowInclusive ?? true,
          range.highInclusive ?? true
        );

        let matched = recordIds
          .map((rid) => this.records.get(rid)!)
          .filter(Boolean);

        if (filter) {
          matched = matched.filter((r) => this.matchesFilter(r, filter));
        }

        if (sort) {
          matched = this.sortRecords(matched, sort.field, sort.order);
        }

        if (limit) {
          matched = matched.slice(0, limit);
        }

        return {
          records: matched,
          usedIndex: true,
          indexName: `bplustree:${range.field}`,
        };
      }
    }

    // 3. Fallback: Full Table Scan
    let matched = Array.from(this.records.values());

    if (filter) {
      matched = matched.filter((r) => this.matchesFilter(r, filter));
    }

    if (range) {
      matched = matched.filter((r) => {
        const val = r[range.field];
        if (val === undefined) return false;
        const lowOk = range.low !== undefined ? (range.lowInclusive !== false ? val >= range.low : val > range.low) : true;
        const highOk = range.high !== undefined ? (range.highInclusive !== false ? val <= range.high : val < range.high) : true;
        return lowOk && highOk;
      });
    }

    if (sort) {
      matched = this.sortRecords(matched, sort.field, sort.order);
    }

    if (limit) {
      matched = matched.slice(0, limit);
    }

    return {
      records: matched,
      usedIndex: false,
    };
  }

  private indexRecord(record: T, recordId: string): void {
    for (const [field, hashIdx] of this.hashIndexes.entries()) {
      const val = record[field];
      if (val !== undefined && val !== null) {
        hashIdx.put(val, recordId);
      }
    }

    for (const [field, btreeIdx] of this.bplusIndexes.entries()) {
      const val = record[field];
      if (val !== undefined && val !== null) {
        btreeIdx.insert(val, recordId);
      }
    }
  }

  private unindexRecord(record: T, recordId: string): void {
    for (const [field, hashIdx] of this.hashIndexes.entries()) {
      const val = record[field];
      if (val !== undefined && val !== null) {
        hashIdx.remove(val);
      }
    }

    for (const [field, btreeIdx] of this.bplusIndexes.entries()) {
      const val = record[field];
      if (val !== undefined && val !== null) {
        btreeIdx.delete(val, recordId);
      }
    }
  }

  private matchesFilter(record: T, filter: Record<string, any>): boolean {
    for (const key of Object.keys(filter)) {
      if (record[key] !== filter[key]) {
        return false;
      }
    }
    return true;
  }

  private sortRecords(records: T[], field: string, order: 'asc' | 'desc'): T[] {
    return [...records].sort((a, b) => {
      const va = a[field];
      const vb = b[field];
      if (va < vb) return order === 'asc' ? -1 : 1;
      if (va > vb) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  public clear(): void {
    this.records.clear();
    for (const hashIdx of this.hashIndexes.values()) {
      // Clear hash index by resetting capacity
      const newHash = new HashIndex<any, string>();
      hashIdx.remove; // reset handled by new table
    }
    for (const field of this.hashIndexes.keys()) {
      this.hashIndexes.set(field, new HashIndex<any, string>());
    }
    for (const field of this.bplusIndexes.keys()) {
      this.bplusIndexes.set(field, new BPlusTree<any, string>(4));
    }
  }
}
