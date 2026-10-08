import { IQueue } from './IQueue';
import { QueuedItem } from '../types';

export class PriorityQueue implements IQueue {
  private items: QueuedItem[] = [];
  private capacity: number;
  private agingIntervalMs: number;
  private agingBoostPerInterval: number;

  constructor(
    capacity: number = 10000,
    agingIntervalMs: number = 100, // Every 100ms of wait boosts priority
    agingBoostPerInterval: number = 25
  ) {
    this.capacity = capacity;
    this.agingIntervalMs = agingIntervalMs;
    this.agingBoostPerInterval = agingBoostPerInterval;
  }

  private calculatePriorityScore(item: QueuedItem, currentTime: number = Date.now()): number {
    const basePriority = item.request.priority === 'HIGH' ? 100 : 10;
    const waitTime = Math.max(0, currentTime - item.enqueued_at);
    const intervals = Math.floor(waitTime / this.agingIntervalMs);
    return basePriority + (intervals * this.agingBoostPerInterval);
  }

  public enqueue(item: QueuedItem): boolean {
    if (this.isFull()) {
      return false;
    }
    item.effective_priority_score = this.calculatePriorityScore(item);
    this.items.push(item);
    this.sortQueue();
    return true;
  }

  private sortQueue(): void {
    const now = Date.now();
    // Recompute aging for all items and sort descending by score, tie-break: earlier enqueued_at first
    for (const it of this.items) {
      it.effective_priority_score = this.calculatePriorityScore(it, now);
    }

    this.items.sort((a, b) => {
      if (b.effective_priority_score !== a.effective_priority_score) {
        return b.effective_priority_score - a.effective_priority_score;
      }
      return a.enqueued_at - b.enqueued_at;
    });
  }

  public dequeue(): QueuedItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    // Re-sort to respect aging before dequeue
    this.sortQueue();
    return this.items.shift();
  }

  public peek(): QueuedItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    this.sortQueue();
    return this.items[0];
  }

  public size(): number {
    return this.items.length;
  }

  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  public isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  public toArray(): QueuedItem[] {
    this.sortQueue();
    return [...this.items];
  }

  public getPosition(requestId: string): number {
    this.sortQueue();
    const idx = this.items.findIndex(i => i.request.request_id === requestId);
    return idx >= 0 ? idx + 1 : -1;
  }

  public clear(): void {
    this.items = [];
  }

  public getPolicyName(): string {
    return 'PRIORITY';
  }
}
