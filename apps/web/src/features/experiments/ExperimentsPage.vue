<script setup lang="ts">
/** Overview: experiments first, then how a run works. */
import { computed } from 'vue';
import PipelineFlow from '../../components/pipeline/PipelineFlow.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import PanelCard from '../../components/ui/PanelCard.vue';
import { formatUsd } from '../../utils/format';
import ExperimentTable from './components/ExperimentTable.vue';
import { useExperiments } from './composables/useExperiments';
import { overviewStats } from './experiments.logic';

const experiments = useExperiments();
const stats = computed(() => overviewStats(experiments.data.value ?? []));
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Overview"
      description="Run a task suite against Hermes configs and find out which one is better, and how sure you can be."
    >
      <template #meta>
        <p v-if="stats.experiments" class="mt-2 text-sm text-ink-500">
          {{ stats.experiments }} experiment{{ stats.experiments === 1 ? '' : 's' }} · {{ stats.runsExecuted }} runs ·
          {{ formatUsd(stats.spentUsd) }} spent on real runs<template v-if="stats.running"> · {{ stats.running }} running now</template>
        </p>
      </template>
      <template #actions>
        <RouterLink to="/new" class="btn-primary"><AppIcon name="plus" :size="16" /> New run</RouterLink>
      </template>
    </PageHeader>

    <PanelCard title="Experiments" subtitle="Newest first. Open one to see its verdicts." flush>
      <ExperimentTable :experiments="experiments.data.value" :loading="experiments.isLoading.value" />
    </PanelCard>

    <PanelCard title="How a run works" subtitle="Six steps. Each writes a file under data/experiments/<id>/ that you can open.">
      <PipelineFlow />
    </PanelCard>
  </div>
</template>
