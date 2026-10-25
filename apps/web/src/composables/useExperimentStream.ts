/**
 * Live updates for one experiment: applies SSE events to the TanStack Query cache
 * (run chips, progress, open trajectories) and keeps a short activity feed.
 */
import { useQueryClient } from '@tanstack/vue-query';
import type { ExperimentDetail, ExperimentEvent, RunDetail } from '@eval-lab/shared';
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { subscribeToExperiment, type EventSubscription } from '../api/events';
import { queryKeys } from '../api/queryKeys';
import { describeStep, parseRunId, type ActivityItem } from '../utils/activity';

const MAX_ACTIVITY = 40;

export function useExperimentStream(id: Ref<string>, enabled: Ref<boolean>) {
  const queryClient = useQueryClient();
  const connected = ref(false);
  const activity = ref<ActivityItem[]>([]);
  /** Short message for screen readers (aria-live), set when a run finishes. */
  const announcement = ref('');
  let subscription: EventSubscription | null = null;
  let nextId = 0;

  const push = (runId: string, kind: ActivityItem['kind'], text: string) => {
    activity.value = [{ id: nextId++, at: Date.now(), runId, run: parseRunId(runId), kind, text }, ...activity.value].slice(
      0,
      MAX_ACTIVITY,
    );
  };
  const patchRun = (runId: string, patch: Partial<ExperimentDetail['runs'][number]>) =>
    queryClient.setQueryData<ExperimentDetail>(queryKeys.experiment(id.value), (old) =>
      old ? { ...old, runs: old.runs.map((r) => (r.runId === runId ? { ...r, ...patch } : r)) } : old,
    );

  function handle(event: ExperimentEvent): void {
    switch (event.type) {
      case 'status':
        queryClient.setQueryData<ExperimentDetail>(queryKeys.experiment(id.value), (old) => (old ? { ...old, status: event.status } : old));
        if (event.status.status !== 'running') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.experiment(id.value) });
          void queryClient.invalidateQueries({ queryKey: queryKeys.experiments });
        }
        break;
      case 'run-started':
        patchRun(event.runId, { status: 'running' });
        push(event.runId, 'started', 'started');
        break;
      case 'run-step':
        push(event.runId, 'step', describeStep(event.step));
        // Append to an open run inspector (dedupe by seq).
        queryClient.setQueryData<RunDetail>(queryKeys.run(id.value, event.runId), (old) =>
          old
            ? { ...old, trajectory: [...old.trajectory.filter((s) => s.seq !== event.step.seq), event.step].sort((a, b) => a.seq - b.seq) }
            : old,
        );
        break;
      case 'run-finished': {
        patchRun(event.runId, { status: event.runStatus, score: event.score, passed: event.passed });
        const kind = event.runStatus !== 'done' ? 'broken' : event.passed ? 'passed' : 'failed';
        const text = kind === 'broken' ? event.runStatus : `${kind} · score ${event.score.toFixed(2)}`;
        push(event.runId, kind, text);
        const r = parseRunId(event.runId);
        announcement.value = `${r.taskId}, ${r.configId}, trial ${r.trial}: ${text}`;
        void queryClient.invalidateQueries({ queryKey: queryKeys.run(id.value, event.runId) });
        break;
      }
    }
  }

  function connect(): void {
    subscription?.close();
    subscription = null;
    connected.value = false;
    if (!enabled.value) return;
    subscription = subscribeToExperiment(id.value, {
      onEvent: handle,
      onOpen: () => (connected.value = true),
      onError: () => (connected.value = false),
    });
  }

  watch([id, enabled], connect, { immediate: true });
  onBeforeUnmount(() => subscription?.close());

  return { connected, activity, announcement };
}
