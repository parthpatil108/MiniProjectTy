import { LockManager } from '../../src/concurrency/lockManager.js';
import { WaitForGraph } from '../../src/concurrency/waitForGraph.js';

describe('M2 - Lock Manager & Deadlock Detection Unit Tests', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  test('WaitForGraph detects direct and indirect cycles', () => {
    const graph = new WaitForGraph();

    // Txn1 -> Txn2 -> Txn3
    expect(graph.addEdge('T1', 'T2')).toBe(false);
    expect(graph.addEdge('T2', 'T3')).toBe(false);

    // Txn3 -> Txn1 creates a cycle: T1 -> T2 -> T3 -> T1
    expect(graph.addEdge('T3', 'T1')).toBe(true);
  });

  test('two transactions racing for exclusive lock on the same record wait sequentially', async () => {
    const table = 'students';
    const recId = 'STU-101';

    // Txn1 acquires Exclusive lock
    await lockManager.acquireLock('T1', table, recId, 'X');

    let t2Acquired = false;

    // Txn2 attempts Exclusive lock on same record (must wait until T1 releases)
    const t2Promise = lockManager.acquireLock('T2', table, recId, 'X').then(() => {
      t2Acquired = true;
    });

    // Give microtask loop a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(t2Acquired).toBe(false); // T2 still waiting

    // Release T1 locks
    lockManager.releaseLocks('T1');

    await t2Promise;
    expect(t2Acquired).toBe(true); // T2 acquired lock after T1 released
  });

  test('deadlock detection fires and aborts request when cycle is formed', async () => {
    // T1 locks RecA (X), T2 locks RecB (X)
    await lockManager.acquireLock('T1', 'table', 'RecA', 'X');
    await lockManager.acquireLock('T2', 'table', 'RecB', 'X');

    // T1 requests RecB (X) -> T1 waits for T2
    const t1Wait = lockManager.acquireLock('T1', 'table', 'RecB', 'X');

    // T2 requests RecA (X) -> T2 waits for T1 -> Cycle detected (T1 -> T2 -> T1)!
    await expect(lockManager.acquireLock('T2', 'table', 'RecA', 'X')).rejects.toThrow(
      /Deadlock cycle detected/
    );

    // Release T2 locks so T1's waiting lock on RecB can proceed and resolve
    lockManager.releaseLocks('T2');
    await t1Wait;

    // Clean up T1 locks
    lockManager.releaseLocks('T1');
  });
});
