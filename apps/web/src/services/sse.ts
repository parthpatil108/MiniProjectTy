import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../design-system/Toast';

export type SSEConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function useLiveOutbox() {
  const [status, setStatus] = useState<SSEConnectionStatus>('disconnected');
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      setStatus('reconnecting');
      try {
        es = new EventSource('/api/v1/ui/stream');
        eventSourceRef.current = es;

        es.onopen = () => {
          setStatus('connected');
        };

        es.addEventListener('OFFER_COMMITTED', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            addToast({
              type: 'success',
              title: 'Offer Issued!',
              message: `Placement offer confirmed for application ${data.application_id || ''}`
            });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          } catch {
            // ignore
          }
        });

        es.addEventListener('ELIGIBILITY_EVALUATED', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            addToast({
              type: 'info',
              title: 'Eligibility Evaluated',
              message: `Application ${data.application_id}: ${data.decision?.outcome || 'Checked'}`
            });
            queryClient.invalidateQueries({ queryKey: ['applications'] });
          } catch {
            // ignore
          }
        });

        es.onmessage = (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'CONNECTED') {
              setStatus('connected');
            }
          } catch {
            // heartbeat or ping
          }
        };

        es.onerror = () => {
          setStatus('reconnecting');
          es?.close();
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch {
        setStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (es) {
        es.close();
      }
    };
  }, [queryClient, addToast]);

  return { status };
}
