import { IQueue } from './IQueue';
import { QueuedItem } from '../types';

export class FifoQueue implements IQueue {
  private items: QueuedItem[] = [];
  private capacity: number;

  constructor(capacity: number = 10000) {
    this.capacity = capacity;
  }

  public enqueue(item: QueuedItem): boolean {
    if (this.isFull()) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  public dequeue(): QueuedItem | undefined {
    return this.items.shift();
  }

  public peek(): QueuedItem | undefined {
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
    return [...this.items];
  }

  public getPosition(requestId: string): number {
    const idx = this.items.findIndex(i => i.request.request_id === requestId);
    return idx >= 0 ? idx + 1 : -1;
  }

  public clear(): void {
    this.items = [];
  }

  public getPolicyName(): string {
    return 'FIFO';
  }
}
