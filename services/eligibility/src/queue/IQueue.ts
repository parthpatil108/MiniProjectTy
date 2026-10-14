import { QueuedItem } from '../types';

export interface IQueue {
  enqueue(item: QueuedItem): boolean;
  dequeue(): QueuedItem | undefined;
  peek(): QueuedItem | undefined;
  size(): number;
  isEmpty(): boolean;
  isFull(): boolean;
  toArray(): QueuedItem[];
  getPosition(requestId: string): number;
  clear(): void;
  getPolicyName(): string;
}
