/** Run detail plus the open workspace file. */
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, type Ref } from 'vue';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { buildTimeline } from '../../../components/run/trajectory.logic';

const POLL_MS = 2000;

export function useRunInspector(id: Ref<string>, runId: Ref<string>) {
  const run = useQuery({
    queryKey: computed(() => queryKeys.run(id.value, runId.value)),
    queryFn: () => api.run(id.value, runId.value),
    // Poll until the run is scored.
    refetchInterval: (q) => (q.state.data && !q.state.data.score ? POLL_MS : false),
  });

  const timeline = computed(() => buildTimeline(run.data.value?.trajectory ?? []));

  const openPath = ref<string | null>(null);
  const file = useQuery({
    queryKey: computed(() => queryKeys.runFile(id.value, runId.value, openPath.value)),
    queryFn: () => api.workspaceFile(id.value, runId.value, openPath.value!),
    enabled: computed(() => openPath.value !== null),
  });

  return { run, timeline, openPath, file };
}
