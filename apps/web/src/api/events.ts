/** Subscribe to an experiment's live events (Server-Sent Events). */
import type { ExperimentEvent } from '@eval-lab/shared';

export interface EventSubscription {
  close(): void;
}

export function subscribeToExperiment(
  id: string,
  handlers: { onEvent: (e: ExperimentEvent) => void; onOpen?: () => void; onError?: () => void },
): EventSubscription {
  const source = new EventSource(`/api/experiments/${encodeURIComponent(id)}/events`);
  source.onopen = () => handlers.onOpen?.();
  source.onerror = () => handlers.onError?.(); // EventSource reconnects by itself
  source.onmessage = (msg) => {
    const event = JSON.parse(msg.data as string) as ExperimentEvent | { type: 'ping' };
    if (event.type !== 'ping') handlers.onEvent(event);
  };
  return { close: () => source.close() };
}
