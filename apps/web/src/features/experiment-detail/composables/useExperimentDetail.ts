/** One experiment: polled progress, report, retry action. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';

/** Poll interval while running. */
/** Fallback polling while running (live updates arrive over SSE). */
const POLL_MS = 4000;

export function useExperimentDetail(id: Ref<string>) {
  const queryClient = useQueryClient();

  const detail = useQuery({
    queryKey: computed(() => queryKeys.experiment(id.value)),
    queryFn: () => api.experiment(id.value),
    refetchInterval: (q) => (q.state.data?.status.status === 'running' ? POLL_MS : false),
  });

  // Keyed by finishedAt so a retry refetches the report.
  const report = useQuery({
    queryKey: computed(() => queryKeys.report(id.value, detail.data.value?.status.finishedAt)),
    queryFn: () => api.report(id.value),
    enabled: computed(() => detail.data.value?.hasReport === true && detail.data.value.status.status !== 'running'),
  });

  /** Re-run timed-out or errored runs. */
  const retryBroken = useMutation({
    mutationFn: () => api.retryBroken(id.value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.experiment(id.value) }),
  });

  return { detail, report, retryBroken };
}
