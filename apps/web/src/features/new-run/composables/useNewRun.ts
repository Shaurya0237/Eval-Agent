/** State and data for the new-run form. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { emptyForm, toRequest, validateForm, type NewRunFormState } from '../newRun.logic';

export function useNewRun() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const health = useQuery({ queryKey: queryKeys.health, queryFn: api.health });
  const definitions = useQuery({ queryKey: queryKeys.definitions, queryFn: api.definitions });

  const form = ref<NewRunFormState>(emptyForm());
  const apiKeyConfigured = computed(() => health.data.value?.apiKeyConfigured ?? false);

  // Defaults: first suite, "baseline" config, simulated agent if no key.
  watch(
    [health.data, definitions.data],
    ([h, d]) => {
      const next = { ...form.value };
      if (h && !h.apiKeyConfigured) next.agent = 'simulated';
      if (d && !next.suiteId && d.suites.length === 1) next.suiteId = d.suites[0].id;
      if (d && !next.baselineConfigId && d.configs.some((c) => c.id === 'baseline')) {
        next.configIds = ['baseline'];
        next.baselineConfigId = 'baseline';
      }
      form.value = next;
    },
    { immediate: true },
  );

  const formError = computed(() => validateForm(form.value, apiKeyConfigured.value));

  const estimate = useQuery({
    queryKey: computed(() => queryKeys.estimate(form.value.suiteId, form.value.configIds, form.value.trials)),
    queryFn: () => api.estimate(toRequest(form.value)),
    enabled: computed(() => !!form.value.suiteId && form.value.configIds.length >= 2 && form.value.trials >= 1),
  });

  const launch = useMutation({
    mutationFn: () => api.createExperiment(toRequest(form.value)),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.experiments });
      await router.push(`/experiments/${created.id}`);
    },
  });

  return { definitions, form, formError, estimate, launch, apiKeyConfigured };
}
