import { TransactionManager } from '../txn/transactionManager.js';
import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';
import { ApplicationStateMachine } from './stateMachine.js';
import { AuditService } from './auditService.js';
import { OutboxService } from './outboxService.js';
import { AppError } from '../api/middleware/errorEnvelope.js';

export interface CommitOfferInput {
  application_id: string;
  decision_id: string;
  lease_id: string;
  ranking_id?: string;
  expectedVersion: number;
}

export interface CompensateOfferInput {
  application_id: string;
  lease_id?: string;
  reason: string;
}

async function releaseTeamALease(leaseId: string, correlationId?: string): Promise<void> {
  if (!leaseId) return;
  const teamAUrl = process.env.TEAM_A_URL || 'http://localhost:3001';
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';
  try {
    await fetch(`${teamAUrl}/internal/v1/locks/${leaseId}`, {
      method: 'DELETE',
      headers: {
        'X-Service-Token': internalSecret,
        ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
      },
    });
  } catch (err: any) {
    console.warn(`[Team C -> Team A compensation] Failed to release lease ${leaseId}:`, err.message);
  }
}


export class OfferService {

  private customTxnManager?: TransactionManager;
  private customStorageManager?: StorageManager;
  private auditService: AuditService;
  private outboxService: OutboxService;

  constructor(
    txnManager?: TransactionManager,
    storageManager?: StorageManager,
    auditService?: AuditService,
    outboxService?: OutboxService
  ) {
    this.customTxnManager = txnManager;
    this.customStorageManager = storageManager;
    this.auditService = auditService || new AuditService(storageManager);
    this.outboxService = outboxService || new OutboxService(storageManager);
  }

  private getTxnManager(): TransactionManager {
    return this.customTxnManager || TransactionManager.getInstance();
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public async commitOffer(input: CommitOfferInput, correlationId: string = '00000000-0000-0000-0000-000000000000'): Promise<any> {
    if (!input.application_id || !input.decision_id || !input.lease_id || input.expectedVersion === undefined) {
      const err: AppError = new Error('Missing required fields (application_id, decision_id, lease_id, expectedVersion)');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const txnManager = this.getTxnManager();
    const txn = txnManager.beginTransaction();

    try {
      // 1. Read application under transaction
      const app = await txnManager.read<BaseRecord>('applications', input.application_id, txn);
      if (!app) {
        const err: AppError = new Error(`Application ${input.application_id} not found`);
        err.code = 'NOT_FOUND';
        throw err;
      }

      // Check version mismatch
      if (app._version !== input.expectedVersion) {
        const err: AppError = new Error(`Version mismatch: expected ${input.expectedVersion}, got ${app._version}`);
        err.code = 'VERSION_MISMATCH';
        throw err;
      }

      // 2. Read drive under transaction
      const drive = await txnManager.read<BaseRecord>('drives', app.drive_id, txn);
      if (!drive) {
        const err: AppError = new Error(`Drive ${app.drive_id} not found`);
        err.code = 'NOT_FOUND';
        throw err;
      }

      // Check seat availability
      if (Number(drive.seats) <= 0) {
        await txnManager.rollback(txn);
        if (input.lease_id) {
          releaseTeamALease(input.lease_id, correlationId);
        }
        return {
          commit_status: 'REJECTED',
          application: app,
          conflict_details: 'SLOT_UNAVAILABLE',
        };
      }

      // 3. Validate state transition to OFFER_ISSUED
      ApplicationStateMachine.validateTransition(app.state, 'OFFER_ISSUED');

      // 4. Update drive seats (decrement by 1)
      await txnManager.write<BaseRecord>(
        'drives',
        app.drive_id,
        'UPDATE',
        { seats: Number(drive.seats) - 1 },
        drive._version,
        txn
      );

      // 5. Update application record to OFFER_ISSUED
      const updatedApp = await txnManager.write<BaseRecord>(
        'applications',
        input.application_id,
        'UPDATE',
        {
          state: 'OFFER_ISSUED',
          decision_id: input.decision_id,
          ranking_id: input.ranking_id || app.ranking_id || null,
        },
        input.expectedVersion,
        txn
      );

      // Commit transaction
      await txnManager.commit(txn);

      // 6. Record Audit Entry & Outbox Event
      this.auditService.recordAudit({
        actor: 'SYSTEM',
        action: 'OFFER_COMMIT',
        entity_id: input.application_id,
        before_state: app,
        after_state: updatedApp,
        correlation_id: correlationId,
      });

      this.outboxService.recordEvent('OFFER_COMMITTED', input.application_id, {
        application_id: input.application_id,
        drive_id: app.drive_id,
        lease_id: input.lease_id,
        state: 'OFFER_ISSUED',
      });

      return {
        commit_status: 'COMMITTED',
        application: {
          application_id: updatedApp?._id || input.application_id,
          student_id: updatedApp?.student_id,
          drive_id: updatedApp?.drive_id,
          resume_version: updatedApp?.resume_version,
          consent: updatedApp?.consent,
          idempotency_key: updatedApp?.idempotency_key,
          state: updatedApp?.state,
          version: updatedApp?._version,
          decision_id: updatedApp?.decision_id,
          ranking_id: updatedApp?.ranking_id,
          created_at: updatedApp?._createdAt,
          updated_at: updatedApp?._updatedAt,
        },
      };
    } catch (err) {
      await txnManager.rollback(txn);
      if (input.lease_id) {
        releaseTeamALease(input.lease_id, correlationId);
      }
      throw err;
    }
  }

  public async compensateOffer(input: CompensateOfferInput, correlationId: string = '00000000-0000-0000-0000-000000000000'): Promise<any> {
    if (!input.application_id || !input.reason) {
      const err: AppError = new Error('Missing required fields (application_id, reason)');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const storageManager = this.getStorageManager();
    const app = storageManager.getById('applications', input.application_id);
    if (!app) {
      const err: AppError = new Error(`Application ${input.application_id} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const txnManager = this.getTxnManager();
    const txn = txnManager.beginTransaction();

    try {
      const updatedApp = await txnManager.write<BaseRecord>(
        'applications',
        input.application_id,
        'UPDATE',
        { state: 'COMPENSATION_REQUIRED' },
        app._version,
        txn
      );

      await txnManager.commit(txn);

      if (input.lease_id) {
        releaseTeamALease(input.lease_id, correlationId);
      }

      this.auditService.recordAudit({
        actor: 'SYSTEM',
        action: 'OFFER_COMPENSATE',
        entity_id: input.application_id,
        before_state: app,
        after_state: updatedApp,
        correlation_id: correlationId,
      });

      return {
        compensated: true,
        application_id: input.application_id,
      };
    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }
}
