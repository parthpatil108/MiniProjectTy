import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  apiVersion: 'v1',
  serviceName: 'team-a-eligibility-engine',
  defaultQueueCapacity: parseInt(process.env.QUEUE_CAPACITY || '10000', 10),
  defaultQueuePolicy: (process.env.QUEUE_POLICY || 'PRIORITY') as 'FIFO' | 'CIRCULAR' | 'PRIORITY' | 'HEAP',
  defaultChainingStrategy: (process.env.DEFAULT_CHAINING_STRATEGY || 'SEQUENTIAL_AND') as 'SEQUENTIAL_AND' | 'WEIGHTED_PRIORITY' | 'DECISION_TREE',
  jwtSigningSecret: process.env.JWT_SIGNING_SECRET || 'changeme',
  idempotencyTtlMs: 24 * 60 * 60 * 1000 // 24 hours per doc 01 §1.1
};
