import { FifoQueue } from '../../src/queue/FifoQueue';
import { CircularQueue } from '../../src/queue/CircularQueue';
import { PriorityQueue } from '../../src/queue/PriorityQueue';
import { BinaryHeapQueue } from '../../src/queue/BinaryHeapQueue';
import { QueueManager } from '../../src/queue/QueueManager';
import { QueuedItem, EligibilityRequest } from '../../src/types';

function createMockItem(id: string, priority: 'NORMAL' | 'HIGH', enqueuedAt: number = Date.now()): QueuedItem {
  const request: EligibilityRequest = {
    request_id: id,
    application_id: `app-${id}`,
    student_id: `STU-${id}`,
    drive_id: 'drive-001',
    rule_set_version: 'v1.0.0',
    priority,
    submitted_at: new Date(enqueuedAt).toISOString()
  };
  return {
    request,
    enqueued_at: enqueuedAt,
    effective_priority_score: priority === 'HIGH' ? 100 : 10
  };
}

describe('Team A - Queue Subsystem', () => {
  describe('FifoQueue', () => {
    it('should maintain strict FIFO ordering', () => {
      const q = new FifoQueue(10);
      const item1 = createMockItem('1', 'NORMAL');
      const item2 = createMockItem('2', 'HIGH');

      expect(q.enqueue(item1)).toBe(true);
      expect(q.enqueue(item2)).toBe(true);
      expect(q.size()).toBe(2);

      expect(q.dequeue()?.request.request_id).toBe('1');
      expect(q.dequeue()?.request.request_id).toBe('2');
      expect(q.isEmpty()).toBe(true);
    });

    it('should reject enqueue when full', () => {
      const q = new FifoQueue(2);
      expect(q.enqueue(createMockItem('1', 'NORMAL'))).toBe(true);
      expect(q.enqueue(createMockItem('2', 'NORMAL'))).toBe(true);
      expect(q.isFull()).toBe(true);
      expect(q.enqueue(createMockItem('3', 'NORMAL'))).toBe(false);
    });

    it('should find positions correctly', () => {
      const q = new FifoQueue(10);
      q.enqueue(createMockItem('1', 'NORMAL'));
      q.enqueue(createMockItem('2', 'NORMAL'));
      expect(q.getPosition('1')).toBe(1);
      expect(q.getPosition('2')).toBe(2);
      expect(q.getPosition('unknown')).toBe(-1);
    });
  });

  describe('CircularQueue', () => {
    it('should act as a fixed ring buffer and wrap around properly', () => {
      const q = new CircularQueue(3);
      q.enqueue(createMockItem('1', 'NORMAL'));
      q.enqueue(createMockItem('2', 'NORMAL'));
      q.enqueue(createMockItem('3', 'NORMAL'));
      expect(q.isFull()).toBe(true);
      expect(q.enqueue(createMockItem('4', 'NORMAL'))).toBe(false);

      // Dequeue 2 items
      expect(q.dequeue()?.request.request_id).toBe('1');
      expect(q.dequeue()?.request.request_id).toBe('2');
      expect(q.size()).toBe(1);

      // Enqueue 2 more items to test wrap-around
      expect(q.enqueue(createMockItem('4', 'NORMAL'))).toBe(true);
      expect(q.enqueue(createMockItem('5', 'NORMAL'))).toBe(true);
      expect(q.isFull()).toBe(true);

      expect(q.dequeue()?.request.request_id).toBe('3');
      expect(q.dequeue()?.request.request_id).toBe('4');
      expect(q.dequeue()?.request.request_id).toBe('5');
      expect(q.isEmpty()).toBe(true);
    });
  });

  describe('PriorityQueue with Dynamic Aging (Starvation Prevention)', () => {
    it('should prioritize HIGH over NORMAL initially', () => {
      const q = new PriorityQueue(10, 500, 20);
      const normal1 = createMockItem('normal-1', 'NORMAL', Date.now());
      const high1 = createMockItem('high-1', 'HIGH', Date.now());

      q.enqueue(normal1);
      q.enqueue(high1);

      expect(q.dequeue()?.request.request_id).toBe('high-1');
      expect(q.dequeue()?.request.request_id).toBe('normal-1');
    });

    it('should boost aged NORMAL requests to prevent starvation under HIGH load', () => {
      // With agingIntervalMs=50 and boost=40:
      // NORMAL base score = 10. After 150ms (3 intervals), score = 10 + 120 = 130 > HIGH base score (100)
      const q = new PriorityQueue(10, 50, 40);
      const pastTime = Date.now() - 200; // waited 200ms
      const starvedNormal = createMockItem('starved-normal', 'NORMAL', pastTime);
      const freshHigh = createMockItem('fresh-high', 'HIGH', Date.now());

      q.enqueue(starvedNormal);
      q.enqueue(freshHigh);

      // The starved normal item should be dequeued BEFORE the fresh high item!
      const first = q.dequeue();
      expect(first?.request.request_id).toBe('starved-normal');
      const second = q.dequeue();
      expect(second?.request.request_id).toBe('fresh-high');
    });
  });

  describe('BinaryHeapQueue', () => {
    it('should extract max priority item efficiently', () => {
      const heap = new BinaryHeapQueue(10);
      heap.enqueue(createMockItem('1', 'NORMAL'));
      heap.enqueue(createMockItem('2', 'HIGH'));
      heap.enqueue(createMockItem('3', 'NORMAL'));

      expect(heap.dequeue()?.request.request_id).toBe('2');
      expect(heap.size()).toBe(2);
    });
  });

  describe('QueueManager', () => {
    it('should isolate queues by drive and support dynamic policy switching', () => {
      const manager = new QueueManager();
      const itemA = createMockItem('item-A', 'NORMAL');
      const itemB = createMockItem('item-B', 'NORMAL');

      manager.enqueue('drive-1', itemA);
      manager.enqueue('drive-2', itemB);

      expect(manager.getTotalQueued('drive-1')).toBe(1);
      expect(manager.getTotalQueued('drive-2')).toBe(1);
      expect(manager.getTotalQueued()).toBe(2);

      // Switch policy
      manager.setQueuePolicy('drive-1', 'CIRCULAR');
      expect(manager.getTotalQueued('drive-1')).toBe(1);

      const view = manager.getQueueView('drive-1');
      expect(view.length).toBe(1);
      expect(view[0].request_id).toBe('item-A');
    });
  });
});
