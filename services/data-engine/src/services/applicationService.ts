import { v4 as uuidv4 } from 'uuid';
import { TransactionManager } from '../txn/transactionManager.js';
import { StorageManager } from '../storage/storageManager.js';
import { ApplicationStateMachine, ApplicationState } from './stateMachine.js';
import { BaseRecord } from '../storage/table.js';
import { AppError } from '../api/middleware/errorEnvelope.js';
import { OutboxService } from './outboxService.js';

export interface CreateApplicationInput {
  student_id: string;
  drive_id: string;
  resume_version: string;
  consent: boolean;
}

export class ApplicationService {
  private customTxnManager?: TransactionManager;
  private customStorageManager?: StorageManager;

  constructor(txnManager?: TransactionManager, storageManager?: StorageManager) {
    this.customTxnManager = txnManager;
    this.customStorageManager = storageManager;
  }

  private getTxnManager(): TransactionManager {
    return this.customTxnManager || TransactionManager.getInstance();
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public async createApplication(input: CreateApplicationInput, idempotencyKey?: string, correlationId?: string): Promise<any> {
    // 1. Validation
    if (input.consent !== true) {
      const err: AppError = new Error('Student consent must be true to proceed');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!input.student_id || !input.drive_id || !input.resume_version) {
      const err: AppError = new Error('Missing required application fields (student_id, drive_id, resume_version)');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const storageManager = this.getStorageManager();
    const txnManager = this.getTxnManager();

    // 2. Check Idempotency Key in Hash Index BEFORE starting transaction
    if (idempotencyKey) {
      const existingQuery = storageManager.query('applications', {
        filter: { idempotency_key: idempotencyKey },
      });
      if (existingQuery.records.length > 0) {
        const existingApp = existingQuery.records[0];
        return {
          application_id: existingApp.application_id,
          state: existingApp.state,
          version: existingApp._version || existingApp.version || 1,
        };
      }
    }

    // 3. Verify student and drive exist
    const student = storageManager.getById('students', input.student_id);
    if (!student) {
      const err: AppError = new Error(`Student ${input.student_id} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const drive = storageManager.getById('drives', input.drive_id);
    if (!drive) {
      const err: AppError = new Error(`Drive ${input.drive_id} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (drive.state !== 'OPEN') {
      const err: AppError = new Error(`Drive ${input.drive_id} is not OPEN (current state: ${drive.state})`);
      err.code = 'STATE_CONFLICT';
      throw err;
    }

    // 4. State Machine check: NULL -> APPLIED
    ApplicationStateMachine.validateTransition(null, 'APPLIED');

    // 5. Execute creation inside single transaction
    const applicationId = uuidv4();
    const txn = txnManager.beginTransaction();

    try {
      const record = await txnManager.write<BaseRecord>(
        'applications',
        applicationId,
        'INSERT',
        {
          application_id: applicationId,
          student_id: input.student_id,
          drive_id: input.drive_id,
          resume_version: input.resume_version,
          consent: true,
          idempotency_key: idempotencyKey || `idem_${uuidv4()}`,
          state: 'APPLIED',
          decision_id: null,
          ranking_id: null,
        },
        undefined,
        txn
      );

      await txnManager.commit(txn);

      // Record in Outbox table so request is never lost
      const outboxService = new OutboxService(this.getStorageManager());
      const eligibilityPayload = {
        request_id: uuidv4(),
        application_id: applicationId,
        student_id: input.student_id,
        drive_id: input.drive_id,
        rule_set_version: 'v1.0.0',
        priority: 'NORMAL',
        submitted_at: new Date().toISOString(),
        correlation_id: correlationId,
        idempotency_key: idempotencyKey || `idem_${applicationId}`,
      };

      const outboxEvent = outboxService.recordEvent(
        'ELIGIBILITY_CHECK_REQUEST',
        applicationId,
        eligibilityPayload,
        'PENDING'
      );

      let queuePosition = 1;
      const TEAM_A_URL = process.env.TEAM_A_URL || process.env.ELIGIBILITY_URL || 'http://localhost:3001';
      const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';

      try {
        const teamARes = await fetch(`${TEAM_A_URL}/api/v1/eligibility/requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Token': internalSecret,
            'X-Correlation-ID': correlationId || uuidv4(),
            'Idempotency-Key': idempotencyKey || `idem_${applicationId}`,
          },
          body: JSON.stringify(eligibilityPayload),
        });
        if (teamARes.ok) {
          const teamAJson: any = await teamARes.json();
          if (teamAJson?.data?.queue_position) {
            queuePosition = teamAJson.data.queue_position;
          }
          outboxService.updateEventStatus(outboxEvent.event_id, 'PROCESSED');
        } else {
          const errText = await teamARes.text();
          outboxService.updateEventStatus(outboxEvent.event_id, 'FAILED', `Status ${teamARes.status}: ${errText}`);
        }
      } catch (err: any) {
        // Outbox keeps the request and retries with backoff
        outboxService.updateEventStatus(outboxEvent.event_id, 'FAILED', err.message);
      }

      return {
        application_id: (record as any)?.application_id || applicationId,
        state: (record as any)?.state || 'APPLIED',
        version: record?._version || 1,
        queue_position: queuePosition,
      };

    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }

  public async getApplicationById(applicationId: string): Promise<any> {
    const app = this.getStorageManager().getById('applications', applicationId);
    if (!app) {
      const err: AppError = new Error(`Application ${applicationId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    return {
      application_id: app.application_id,
      student_id: app.student_id,
      drive_id: app.drive_id,
      resume_version: app.resume_version,
      consent: app.consent,
      idempotency_key: app.idempotency_key,
      state: app.state,
      version: app._version || app.version || 1,
      decision_id: app.decision_id || null,
      ranking_id: app.ranking_id || null,
      created_at: app._createdAt,
      updated_at: app._updatedAt,
    };
  }

  public async withdrawApplication(
    applicationId: string,
    idempotencyKey?: string,
    expectedVersion?: number
  ): Promise<any> {
    const storageManager = this.getStorageManager();
    const existingCheck = storageManager.getById('applications', applicationId);
    if (!existingCheck) {
      const err: AppError = new Error(`Application ${applicationId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const txnManager = this.getTxnManager();
    const txn = txnManager.beginTransaction();

    try {
      // 1. Read existing record under transaction (acquires Exclusive lock)
      const existing = await txnManager.read<BaseRecord>('applications', applicationId, txn);
      if (!existing) {
        const err: AppError = new Error(`Application ${applicationId} not found`);
        err.code = 'NOT_FOUND';
        throw err;
      }

      // 2. Validate state machine transition -> WITHDRAWN
      ApplicationStateMachine.validateTransition(existing.state, 'WITHDRAWN');

      // 3. Update record state to WITHDRAWN
      const updated = await txnManager.write<BaseRecord>(
        'applications',
        applicationId,
        'UPDATE',
        { state: 'WITHDRAWN' },
        expectedVersion !== undefined ? expectedVersion : existing._version,
        txn
      );

      await txnManager.commit(txn);

      return {
        application_id: (updated as any)?.application_id || applicationId,
        student_id: (updated as any)?.student_id,
        drive_id: (updated as any)?.drive_id,
        resume_version: (updated as any)?.resume_version,
        consent: (updated as any)?.consent,
        idempotency_key: (updated as any)?.idempotency_key,
        state: (updated as any)?.state || 'WITHDRAWN',
        version: updated?._version,
        decision_id: (updated as any)?.decision_id || null,
        ranking_id: (updated as any)?.ranking_id || null,
        created_at: updated?._createdAt,
        updated_at: updated?._updatedAt,
      };
    } catch (err) {
      await txnManager.rollback(txn);
      throw err;
    }
  }
}
