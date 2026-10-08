import { IQueue } from './IQueue';
import { QueuedItem } from '../types';

export class CircularQueue implements IQueue {
  private buffer: (QueuedItem | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.buffer = new Array<QueuedItem | undefined>(capacity);
  }

  public enqueue(item: QueuedItem): boolean {
    if (this.isFull()) {
      return false;
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this.count++;
    return true;
  }

  public dequeue(): QueuedItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this.count--;
    return item;
  }

  public peek(): QueuedItem | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    return this.buffer[this.head];
  }

  public size(): number {
    return this.count;
  }

  public isEmpty(): boolean {
    return this.count === 0;
  }

  public isFull(): boolean {
    return this.count >= this.capacity;
  }

  public toArray(): QueuedItem[] {
    const result: QueuedItem[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item) {
        result.push(item);
      }
    }
    return result;
  }

  public getPosition(requestId: string): number {
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item && item.request.request_id === requestId) {
        return i + 1;
      }
    }
    return -1;
  }

  public clear(): void {
    this.buffer = new Array<QueuedItem | undefined>(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  public getPolicyName(): string {
    return 'CIRCULAR';
  }
}
