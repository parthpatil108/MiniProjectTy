import { IQueue } from './IQueue';
import { FifoQueue } from './FifoQueue';
import { CircularQueue } from './CircularQueue';
import { PriorityQueue } from './PriorityQueue';
import { BinaryHeapQueue } from './BinaryHeapQueue';
import { QueuePolicy, QueuedItem, QueueEntryView } from '../types';
import { config } from '../config/env';

export class QueueManager {
  private queuesByDrive: Map<string, IQueue> = new Map();
  private defaultPolicy: QueuePolicy;
  private capacity: number;
  private avgEvaluationTimeMs: number = 15; // default initial benchmark assumption

  constructor(defaultPolicy: QueuePolicy = config.defaultQueuePolicy, capacity: number = config.defaultQueueCapacity) {
    this.defaultPolicy = defaultPolicy;
    this.capacity = capacity;
  }

  public createQueue(policy: QueuePolicy = this.defaultPolicy): IQueue {
    switch (policy) {
      case 'FIFO':
        return new FifoQueue(this.capacity);
      case 'CIRCULAR':
        return new CircularQueue(this.capacity);
      case 'PRIORITY':
        return new PriorityQueue(this.capacity);
      case 'HEAP':
        return new BinaryHeapQueue(this.capacity);
      default:
        return new PriorityQueue(this.capacity);
    }
  }

  public getOrCreateQueue(driveId: string, policy?: QueuePolicy): IQueue {
    let queue = this.queuesByDrive.get(driveId);
    if (!queue) {
      queue = this.createQueue(policy || this.defaultPolicy);
      this.queuesByDrive.set(driveId, queue);
    }
    return queue;
  }

  public setQueuePolicy(driveId: string, policy: QueuePolicy): void {
    const existing = this.queuesByDrive.get(driveId);
    const newQueue = this.createQueue(policy);
    if (existing) {
      const items = existing.toArray();
      for (const it of items) {
        newQueue.enqueue(it);
      }
    }
    this.queuesByDrive.set(driveId, newQueue);
  }

  public enqueue(driveId: string, item: QueuedItem): { success: boolean; position: number; estimatedEvaluationTimeMs: number } {
    const queue = this.getOrCreateQueue(driveId);
    const success = queue.enqueue(item);
    if (!success) {
      return { success: false, position: -1, estimatedEvaluationTimeMs: 0 };
    }
    const position = queue.getPosition(item.request.request_id);
    const estimatedEvaluationTimeMs = Math.max(5, position * this.avgEvaluationTimeMs);
    return { success: true, position, estimatedEvaluationTimeMs };
  }

  public dequeue(driveId: string): QueuedItem | undefined {
    const queue = this.queuesByDrive.get(driveId);
    if (!queue) return undefined;
    return queue.dequeue();
  }

  public getQueueView(driveId: string): QueueEntryView[] {
    const queue = this.queuesByDrive.get(driveId);
    if (!queue) return [];

    const items = queue.toArray();
    return items.map((item, index) => ({
      request_id: item.request.request_id,
      student_id: item.request.student_id,
      priority: item.request.priority,
      position: index + 1,
      estimated_wait_ms: Math.max(5, (index + 1) * this.avgEvaluationTimeMs)
    }));
  }

  public getPosition(driveId: string, requestId: string): number {
    const queue = this.queuesByDrive.get(driveId);
    if (!queue) return -1;
    return queue.getPosition(requestId);
  }

  public getTotalQueued(driveId?: string): number {
    if (driveId) {
      return this.queuesByDrive.get(driveId)?.size() || 0;
    }
    let total = 0;
    for (const q of this.queuesByDrive.values()) {
      total += q.size();
    }
    return total;
  }

  public updateAverageEvaluationTime(evaluationTimeMs: number): void {
    if (evaluationTimeMs > 0) {
      // Exponential moving average
      this.avgEvaluationTimeMs = (this.avgEvaluationTimeMs * 0.9) + (evaluationTimeMs * 0.1);
    }
  }

  public clear(driveId?: string): void {
    if (driveId) {
      this.queuesByDrive.get(driveId)?.clear();
    } else {
      this.queuesByDrive.clear();
    }
  }
}
