/** Both runs and their timelines. */
import { useQuery } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { buildTimeline } from '../../../components/run/trajectory.logic';

export function useRunCompare(id: Ref<string>, leftId: Ref<string>, rightId: Ref<string>) {
  const left = useQuery({
    queryKey: computed(() => queryKeys.run(id.value, leftId.value)),
    queryFn: () => api.run(id.value, leftId.value),
  });
  const right = useQuery({
    queryKey: computed(() => queryKeys.run(id.value, rightId.value)),
    queryFn: () => api.run(id.value, rightId.value),
  });
  const leftTimeline = computed(() => buildTimeline(left.data.value?.trajectory ?? []));
  const rightTimeline = computed(() => buildTimeline(right.data.value?.trajectory ?? []));
  return { left, right, leftTimeline, rightTimeline };
}
