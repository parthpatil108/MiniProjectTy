import { v4 as uuidv4 } from 'uuid';
import { WaitForGraph } from './waitForGraph';
import { globalMetricsCollector } from '../telemetry/MetricsCollector';

interface LockEntry {
  slot_id: string;
  holder_id: string;
  lease_id: string;
  expires_at: number;
}

export class LockManager {
  private locks: Map<string, LockEntry> = new Map();
  private waitGraph = new WaitForGraph();

  // For simplicity, we just reject if acquired and handle deadlock simulation.
  public acquireSlotLock(slotId: string, holderId: string, timeoutMs: number = 30000): { lock_granted: boolean; lease_id: string | null; conflict_reason?: string } {
    const now = Date.now();
    const existing = this.locks.get(slotId);

    if (existing) {
      if (existing.expires_at > now && existing.holder_id !== holderId) {
        // Record wait
        const hasCycle = this.waitGraph.addEdge(holderId, existing.holder_id);
        if (hasCycle) {
          globalMetricsCollector.recordDeadlock();
          this.waitGraph.removeEdge(holderId, existing.holder_id);
          return { lock_granted: false, lease_id: null, conflict_reason: 'DEADLOCK_DETECTED' };
        }
        return { lock_granted: false, lease_id: null, conflict_reason: 'SLOT_LOCKED' };
      }
    }

    // Grant lock
    const lease_id = uuidv4();
    this.locks.set(slotId, {
      slot_id: slotId,
      holder_id: holderId,
      lease_id,
      expires_at: now + timeoutMs
    });
    // Remove from wait graph
    this.waitGraph.removeNode(holderId);

    return { lock_granted: true, lease_id };
  }

  public releaseSlotLock(leaseId: string): { released: boolean; lease_id: string } {
    for (const [slotId, entry] of this.locks.entries()) {
      if (entry.lease_id === leaseId) {
        this.locks.delete(slotId);
        this.waitGraph.removeNode(entry.holder_id);
        return { released: true, lease_id: leaseId };
      }
    }
    return { released: false, lease_id: leaseId };
  }
}

export const globalLockManager = new LockManager();
