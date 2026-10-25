/** SERVICE · In-process event bus for live experiment updates (consumed by the SSE endpoint). */
import { Injectable } from '@nestjs/common';
import type { ExperimentEvent } from '@eval-lab/shared';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';

/** SSE message shape Nest expects from an @Sse() handler. */
export interface SseMessage {
  data: ExperimentEvent | { type: 'ping' };
}

const HEARTBEAT_MS = 15_000;

@Injectable()
export class EventsService {
  private readonly bus = new Subject<{ experimentId: string; event: ExperimentEvent }>();

  publish(experimentId: string, event: ExperimentEvent): void {
    this.bus.next({ experimentId, event });
  }

  /** Events for one experiment, plus a heartbeat so proxies keep the connection open. */
  stream(experimentId: string): Observable<SseMessage> {
    const events = this.bus.pipe(
      filter((e) => e.experimentId === experimentId),
      map((e): SseMessage => ({ data: e.event })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): SseMessage => ({ data: { type: 'ping' } })));
    return merge(events, heartbeat);
  }
}
