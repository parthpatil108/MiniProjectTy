import { Response } from 'express';

export interface StreamEvent {
  event: 'REQUEST_ENQUEUED' | 'EVALUATION_COMPLETED' | 'METRICS_UPDATE' | 'HEARTBEAT';
  data: Record<string, any>;
  timestamp: string;
}

export class EventStream {
  private clients: Set<Response> = new Set();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor() {
    // Send heartbeat comment every 15s to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        event: 'HEARTBEAT',
        data: { status: 'alive' },
        timestamp: new Date().toISOString()
      });
    }, 15000);
    this.heartbeatInterval.unref();
  }

  public addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('retry: 5000\n\n');

    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  public broadcast(event: StreamEvent): void {
    const payload = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public closeAll(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const client of this.clients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
  }
}
