/** Experiment list, polled while any run is in progress. */
import { useQuery } from '@tanstack/vue-query';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';

const POLL_MS = 1500;

export function useExperiments() {
  return useQuery({
    queryKey: queryKeys.experiments,
    queryFn: api.experiments,
    refetchInterval: (q) => (q.state.data?.some((e) => e.status === 'running') ? POLL_MS : false),
  });
}
