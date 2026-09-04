import { StorageManager } from '../storage/storageManager.js';
import { BaseRecord } from '../storage/table.js';

export interface OutboxEvent {
  event_id: string;
  event_type: string;
  application_id: string;
  payload: any;
  timestamp: string;
}

export class OutboxService {
  private customStorageManager?: StorageManager;
  private static events: OutboxEvent[] = [];

  constructor(storageManager?: StorageManager) {
    this.customStorageManager = storageManager;
  }

  private getStorageManager(): StorageManager {
    return this.customStorageManager || StorageManager.getInstance();
  }

  public recordEvent(eventType: string, applicationId: string, payload: any): OutboxEvent {
    const event: OutboxEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      event_type: eventType,
      application_id: applicationId,
      payload,
      timestamp: new Date().toISOString(),
    };

    OutboxService.events.push(event);

    try {
      this.getStorageManager().insert<BaseRecord>('outbox', {
        ...event,
        _id: event.event_id,
      });
    } catch (err) {
      // Ignore if table storage fails
    }

    return event;
  }

  public getAllEvents(): OutboxEvent[] {
    return OutboxService.events;
  }
}
