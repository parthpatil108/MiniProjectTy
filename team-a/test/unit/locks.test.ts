import { LockManager } from '../../src/locks/lockManager';
import { WaitForGraph } from '../../src/locks/waitForGraph';

describe('Team A - Concurrency, Locks & Deadlock Detection', () => {
  describe('WaitForGraph Cycle Detection', () => {
    it('should detect a direct two-node deadlock cycle (T1 -> T2 -> T1)', () => {
      const graph = new WaitForGraph();
      const hasCycle1 = graph.addEdge('T1', 'T2');
      expect(hasCycle1).toBe(false);

      const hasCycle2 = graph.addEdge('T2', 'T1');
      expect(hasCycle2).toBe(true);
      const cycle = graph.findCycle();
      expect(cycle).not.toBeNull();
      expect(cycle).toContain('T1');
      expect(cycle).toContain('T2');
    });

    it('should detect a multi-node circular wait cycle (A -> B -> C -> A)', () => {
      const graph = new WaitForGraph();
      graph.addEdge('A', 'B');
      graph.addEdge('B', 'C');
      const hasCycle = graph.addEdge('C', 'A');
      expect(hasCycle).toBe(true);
      const cycle = graph.findCycle();
      expect(cycle).not.toBeNull();
      expect(cycle).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    });


    it('should report no cycle when wait graph is a DAG (A -> B, A -> C, B -> D, C -> D)', () => {
      const graph = new WaitForGraph();
      graph.addEdge('A', 'B');
      graph.addEdge('A', 'C');
      graph.addEdge('B', 'D');
      const hasCycle = graph.addEdge('C', 'D');
      expect(hasCycle).toBe(false);
      expect(graph.findCycle()).toBeNull();
    });

    it('should clear cycles when edge or node is removed', () => {
      const graph = new WaitForGraph();
      graph.addEdge('T1', 'T2');
      graph.addEdge('T2', 'T1');
      expect(graph.findCycle()).not.toBeNull();

      graph.removeNode('T1');
      expect(graph.findCycle()).toBeNull();
    });
  });

  describe('LockManager Slot Allocation & Concurrency', () => {
    let lockManager: LockManager;

    beforeEach(() => {
      lockManager = new LockManager();
    });

    it('should grant exclusive lock lease to first applicant', () => {
      const res = lockManager.acquireSlotLock('SLOT-101', 'STU-1001', 5000);
      expect(res.lock_granted).toBe(true);
      expect(res.lease_id).toBeDefined();
    });

    it('should reject second applicant for the same exclusive slot (0 duplicate allocations)', () => {
      const res1 = lockManager.acquireSlotLock('SLOT-101', 'STU-1001', 5000);
      expect(res1.lock_granted).toBe(true);

      const res2 = lockManager.acquireSlotLock('SLOT-101', 'STU-1002', 5000);
      expect(res2.lock_granted).toBe(false);
      expect(res2.lease_id).toBeNull();
      expect(res2.conflict_reason).toBe('SLOT_LOCKED');
    });

    it('should allow slot re-acquisition after release', () => {
      const res1 = lockManager.acquireSlotLock('SLOT-101', 'STU-1001', 5000);
      expect(res1.lock_granted).toBe(true);

      const rel = lockManager.releaseSlotLock(res1.lease_id!);
      expect(rel.released).toBe(true);

      const res2 = lockManager.acquireSlotLock('SLOT-101', 'STU-1002', 5000);
      expect(res2.lock_granted).toBe(true);
    });

    it('should detect deadlock when mutual dependency occurs across slots', () => {
      // STU-1 holds SLOT-1
      lockManager.acquireSlotLock('SLOT-1', 'STU-1', 10000);
      // STU-2 holds SLOT-2
      lockManager.acquireSlotLock('SLOT-2', 'STU-2', 10000);

      // STU-1 requests SLOT-2 (STU-1 waits for STU-2)
      const resA = lockManager.acquireSlotLock('SLOT-2', 'STU-1', 10000);
      expect(resA.lock_granted).toBe(false);

      // STU-2 requests SLOT-1 (STU-2 waits for STU-1 -> CYCLE!)
      const resB = lockManager.acquireSlotLock('SLOT-1', 'STU-2', 10000);
      expect(resB.lock_granted).toBe(false);
      expect(resB.conflict_reason).toBe('DEADLOCK_DETECTED');
    });

    it('should analyze arbitrary wait-for edges via analyzeDeadlocks', () => {
      const analysis = lockManager.analyzeDeadlocks([
        { waiter: 'T1', holder: 'T2' },
        { waiter: 'T2', holder: 'T3' },
        { waiter: 'T3', holder: 'T1' }
      ]);

      expect(analysis.deadlock_cycle).toEqual(expect.arrayContaining(['T1', 'T2', 'T3']));
      expect(analysis.prevention_or_recovery_action).toBe('ABORT_YOUNGEST_TRANSACTION');

    });
  });
});
