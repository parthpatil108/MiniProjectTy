import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';
import { EventEmitter } from 'events';

export type OutboxStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER';

export interface OutboxEvent {
  event_id: string;
  event_type: string;
  application_id: string;
  payload: any;
  timestamp: string;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt?: number;
  lastError?: string;
}

export class OutboxService {
  private customStorageManager?: StorageManager;
  private static events: OutboxEvent[] = [];
  public static emitter = new EventEmitter();

  constructor(storageManager?: StorageManager) {
    this.customStorageManager = storageManager;
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public recordEvent(
    eventType: string,
    applicationId: string,
    payload: any,
    status: OutboxStatus = 'PENDING'
  ): OutboxEvent {
    const event: OutboxEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event_type: eventType,
      application_id: applicationId,
      payload,
      timestamp: new Date().toISOString(),
      status,
      retryCount: 0,
      nextRetryAt: Date.now()
    };

    OutboxService.events.push(event);
    OutboxService.emitter.emit('new_event', event);

    try {
      this.getStorageManager().insert<BaseRecord>('outbox', {
        ...event,
        _id: event.event_id,
      });
    } catch {
      // Ignore if table storage fails
    }

    return event;
  }

  public updateEventStatus(
    eventId: string,
    status: OutboxStatus,
    error?: string
  ): void {
    const event = OutboxService.events.find(e => e.event_id === eventId);
    if (event) {
      event.status = status;
      if (error) {
        event.lastError = error;
        event.retryCount = (event.retryCount || 0) + 1;
        if (event.retryCount >= 5) {
          event.status = 'DEAD_LETTER';
        } else {
          event.nextRetryAt = Date.now() + Math.pow(2, event.retryCount) * 1000;
        }
      }
      try {
        this.getStorageManager().update('outbox', eventId, {
          status: event.status,
          retryCount: event.retryCount,
          nextRetryAt: event.nextRetryAt,
          lastError: event.lastError
        });
      } catch {
        // Table update fallback
      }
    }
  }

  public getAllEvents(): OutboxEvent[] {
    return OutboxService.events;
  }

  public getPendingEvents(): OutboxEvent[] {
    const now = Date.now();
    return OutboxService.events.filter(
      e => (e.status === 'PENDING' || e.status === 'FAILED') &&
           (!e.nextRetryAt || e.nextRetryAt <= now)
    );
  }

  public async processPendingEvents(): Promise<{ processed: number; failed: number }> {
    const pending = this.getPendingEvents();
    let processed = 0;
    let failed = 0;

    const teamAUrl = process.env.TEAM_A_URL || process.env.ELIGIBILITY_URL || 'http://localhost:3001';
    const teamBUrl = process.env.TEAM_B_URL || process.env.RANKING_URL || 'http://localhost:3002';
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'internal-service-auth-key-2026-secure';

    for (const evt of pending) {
      try {
        if (evt.event_type === 'ELIGIBILITY_CHECK_REQUEST') {
          const res = await fetch(`${teamAUrl}/api/v1/eligibility/requests`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': internalSecret,
              'X-Correlation-ID': evt.payload.correlation_id || evt.event_id,
              'Idempotency-Key': evt.payload.idempotency_key || evt.event_id,
            },
            body: JSON.stringify(evt.payload)
          });
          if (res.ok) {
            this.updateEventStatus(evt.event_id, 'PROCESSED');
            processed++;
          } else {
            const err = await res.text();
            this.updateEventStatus(evt.event_id, 'FAILED', `Status ${res.status}: ${err}`);
            failed++;
          }
        } else if (evt.event_type === 'SYNC_STUDENT_PROFILE') {
          const student = evt.payload;
          const res = await fetch(`${teamBUrl}/internal/v1/profiles/students/${student.student_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': internalSecret
            },
            body: JSON.stringify(student)
          });
          if (res.ok) {
            this.updateEventStatus(evt.event_id, 'PROCESSED');
            processed++;
          } else {
            this.updateEventStatus(evt.event_id, 'FAILED', `Status ${res.status}`);
            failed++;
          }
        } else if (evt.event_type === 'SYNC_DRIVE_PROFILE') {
          const drive = evt.payload;
          const res = await fetch(`${teamBUrl}/internal/v1/profiles/drives/${drive.drive_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Token': internalSecret
            },
            body: JSON.stringify(drive)
          });
          if (res.ok) {
            this.updateEventStatus(evt.event_id, 'PROCESSED');
            processed++;
          } else {
            this.updateEventStatus(evt.event_id, 'FAILED', `Status ${res.status}`);
            failed++;
          }
        } else {
          // Default event (e.g. audit or offer notification)
          this.updateEventStatus(evt.event_id, 'PROCESSED');
          processed++;
        }
      } catch (err: any) {
        this.updateEventStatus(evt.event_id, 'FAILED', err.message);
        failed++;
      }
    }

    return { processed, failed };
  }
}
