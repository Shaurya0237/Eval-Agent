<script setup lang="ts">
/** Experiment title, actions, and the live progress strip. */
import type { ExperimentStatusFile, PipelineStep } from '@eval-lab/shared';
import AppIcon from '../../../components/ui/AppIcon.vue';
import PageHeader from '../../../components/ui/PageHeader.vue';
import SimulatedBadge from '../../../components/ui/SimulatedBadge.vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';
import type { StepState } from '../experimentDetail.logic';

const props = defineProps<{
  status: ExperimentStatusFile;
  steps: { step: PipelineStep; label: string; state: StepState }[];
  live: boolean;
  brokenRuns: number;
  exportCsvUrl: string;
  exportJsonUrl: string;
  retrying: boolean;
  retryError: string | null;
}>();
const emit = defineEmits<{ retry: [] }>();

const progress = () => (props.status.runsTotal ? Math.round((props.status.runsFinished / props.status.runsTotal) * 100) : 0);
const STEP: Record<StepState, { cls: string; icon: string; sr: string }> = {
  done: { cls: 'text-good', icon: '✓', sr: 'done' },
  active: { cls: 'text-accent font-semibold', icon: '●', sr: 'in progress' },
  waiting: { cls: 'text-ink-500', icon: '○', sr: 'waiting' },
  failed: { cls: 'text-bad font-semibold', icon: '✗', sr: 'failed' },
};
</script>

<template>
  <PageHeader :title="status.name" :breadcrumbs="[{ label: 'Overview', to: '/' }, { label: status.name }]">
    <template #badges>
      <StatusBadge :status="status.status" />
      <SimulatedBadge v-if="status.agent === 'simulated'" />
      <span v-if="live" class="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-xs font-semibold text-good">
        <span class="live-dot" aria-hidden="true" /> Live
      </span>
    </template>
    <template #meta>
      <p class="mt-1 text-sm text-ink-400">
        Suite <span class="text-ink-200">{{ status.suiteId }}</span> · {{ status.configIds.length }} configs compared with
        <span class="text-ink-200">{{ status.baselineConfigId }}</span> · {{ status.trials }} trials per task
        <template v-if="status.retries"> · retried {{ status.retries }}×</template>
      </p>
    </template>
    <template #actions>
      <button v-if="brokenRuns > 0 && status.status !== 'running'" type="button" class="btn" :disabled="retrying" @click="emit('retry')">
        <AppIcon name="retry" :size="15" /> {{ retrying ? 'Retrying…' : `Retry ${brokenRuns} broken` }}
      </button>
      <a class="btn" :href="exportCsvUrl" download><AppIcon name="download" :size="15" /> CSV</a>
      <a class="btn" :href="exportJsonUrl" download><AppIcon name="download" :size="15" /> JSON</a>
    </template>
  </PageHeader>

  <!-- Progress strip: only while the experiment is not finished. -->
  <div v-if="status.status !== 'completed'" class="card -mt-2 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
    <ol class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Pipeline progress">
      <li v-for="s in steps" :key="s.step" :class="STEP[s.state].cls">
        <span aria-hidden="true" :class="s.state === 'active' ? 'animate-pulse' : ''">{{ STEP[s.state].icon }}</span>
        {{ s.label }}<span class="sr-only">: {{ STEP[s.state].sr }}</span>
      </li>
    </ol>
    <div class="flex min-w-48 flex-1 items-center gap-3">
      <div
        class="h-2 flex-1 overflow-hidden rounded-full bg-ink-800"
        role="progressbar"
        aria-label="Runs finished"
        :aria-valuenow="progress()"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full transition-[width] duration-500"
          :class="status.status === 'failed' ? 'bg-bad' : status.status === 'running' ? 'bg-accent' : 'bg-good'"
          :style="{ width: `${progress()}%` }"
        />
      </div>
      <span class="tabular text-sm text-ink-300">{{ status.runsFinished }}/{{ status.runsTotal }}</span>
    </div>
  </div>

  <p v-if="retryError" role="alert" class="mb-4 text-sm text-bad">{{ retryError }}</p>
  <p v-if="status.error" role="alert" class="mb-6 rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">
    {{ status.error }}
  </p>
</template>
