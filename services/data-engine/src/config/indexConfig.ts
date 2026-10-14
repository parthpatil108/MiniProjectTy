export interface TableIndexSpec {
  hash: string[];
  bplustree: string[];
}

export interface IndexConfig {
  [tableName: string]: TableIndexSpec;
}

export const indexConfig: IndexConfig = {
  applications: {
    hash: ['application_id', 'idempotency_key'],
    bplustree: ['drive_id', 'created_at'],
  },
  students: {
    hash: ['student_id'],
    bplustree: ['cgpa'],
  },
  drives: {
    hash: ['drive_id'],
    bplustree: [],
  },
};
