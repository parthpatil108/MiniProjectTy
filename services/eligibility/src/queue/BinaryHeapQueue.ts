import { IQueue } from './IQueue';
import { QueuedItem } from '../types';

export class BinaryHeapQueue implements IQueue {
  private heap: QueuedItem[] = [];
  private capacity: number;
  private agingIntervalMs: number;
  private agingBoostPerInterval: number;

  constructor(
    capacity: number = 10000,
    agingIntervalMs: number = 100,
    agingBoostPerInterval: number = 25
  ) {
    this.capacity = capacity;
    this.agingIntervalMs = agingIntervalMs;
    this.agingBoostPerInterval = agingBoostPerInterval;
  }

  private score(item: QueuedItem, now: number = Date.now()): number {
    const base = item.request.priority === 'HIGH' ? 100 : 10;
    const waitTime = Math.max(0, now - item.enqueued_at);
    const intervals = Math.floor(waitTime / this.agingIntervalMs);
    return base + (intervals * this.agingBoostPerInterval);
  }

  private compare(a: QueuedItem, b: QueuedItem, now: number): number {
    const scoreA = this.score(a, now);
    const scoreB = this.score(b, now);
    if (scoreA !== scoreB) {
      return scoreA - scoreB; // Higher score has higher priority
    }
    // Tie-break: older arrival (smaller enqueued_at) comes first
    return b.enqueued_at - a.enqueued_at;
  }

  public enqueue(item: QueuedItem): boolean {
    if (this.isFull()) {
      return false;
    }
    const now = Date.now();
    item.effective_priority_score = this.score(item, now);
    this.heap.push(item);
    this.siftUp(this.heap.length - 1, now);
    return true;
  }

  private siftUp(index: number, now: number): void {
    let current = index;
    while (current > 0) {
      const parent = (current - 1) >> 1;
      if (this.compare(this.heap[current], this.heap[parent], now) > 0) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number, now: number): void {
    const length = this.heap.length;
    let current = index;

    while (true) {
      let largest = current;
      const left = (current << 1) + 1;
      const right = left + 1;

      if (left < length && this.compare(this.heap[left], this.heap[largest], now) > 0) {
        largest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[largest], now) > 0) {
        largest = right;
      }

      if (largest !== current) {
        this.swap(current, largest);
        current = largest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  public dequeue(): QueuedItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const now = Date.now();
    const root = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0, now);
    }
    return root;
  }

  public peek(): QueuedItem | undefined {
    return this.heap[0];
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public isFull(): boolean {
    return this.heap.length >= this.capacity;
  }

  public toArray(): QueuedItem[] {
    const now = Date.now();
    // Return items sorted by current priority
    return [...this.heap].sort((a, b) => this.compare(b, a, now));
  }

  public getPosition(requestId: string): number {
    const sorted = this.toArray();
    const idx = sorted.findIndex(i => i.request.request_id === requestId);
    return idx >= 0 ? idx + 1 : -1;
  }

  public clear(): void {
    this.heap = [];
  }

  public getPolicyName(): string {
    return 'HEAP';
  }
}
