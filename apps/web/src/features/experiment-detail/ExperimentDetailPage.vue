<script setup lang="ts">
/** Page: one experiment (live progress, verdicts, task diff, activity, runs). */
import { computed, ref, toRef, watch } from 'vue';
import { api } from '../../api';
import ForestPlot from '../../components/charts/ForestPlot.vue';
import PanelCard from '../../components/ui/PanelCard.vue';
import StatCard from '../../components/ui/StatCard.vue';
import { useExperimentStream } from '../../composables/useExperimentStream';
import { formatScore, formatUsd } from '../../utils/format';
import ExperimentHeader from './components/ExperimentHeader.vue';
import LiveActivity from './components/LiveActivity.vue';
import ResultsTable from './components/ResultsTable.vue';
import RunGrid from './components/RunGrid.vue';
import TaskDiffTable from './components/TaskDiffTable.vue';
import { useExperimentDetail } from './composables/useExperimentDetail';
import {
  bestConfig,
  brokenRunCount,
  buildRunGrid,
  diffRows,
  filterCounts,
  forestRows,
  stepStates,
  verdictSummary,
  type DiffFilter,
} from './experimentDetail.logic';

const props = defineProps<{ id: string }>();
const id = toRef(props, 'id');
const { detail, report, retryBroken } = useExperimentDetail(id);

const status = computed(() => detail.data.value?.status);
const running = computed(() => status.value?.status === 'running');
const { connected, activity, announcement } = useExperimentStream(id, running);

const grid = computed(() => (detail.data.value && status.value ? buildRunGrid(detail.data.value.runs, status.value.configIds) : []));
const broken = computed(() => brokenRunCount(detail.data.value?.runs ?? []));
const best = computed(() => (report.data.value ? bestConfig(report.data.value) : null));
const passed = computed(() => (detail.data.value?.runs ?? []).filter((r) => r.passed).length);

// Task diff: selected candidate and filter.
const candidate = ref('');
const filter = ref<DiffFilter>('all');
watch(
  report.data,
  (r) => {
    if (r && !r.comparisons.some((c) => c.configId === candidate.value)) candidate.value = r.comparisons[0]?.configId ?? '';
  },
  { immediate: true },
);
const rows = computed(() => (report.data.value ? diffRows(report.data.value, candidate.value, filter.value) : []));
const showActivity = computed(() => running.value || activity.value.length > 0);
const counts = computed(() => (report.data.value ? filterCounts(report.data.value, candidate.value) : null));
</script>

<template>
  <div>
    <p v-if="detail.isLoading.value" class="text-ink-400">Loading experiment…</p>
    <p v-else-if="detail.error.value" role="alert" class="text-bad">{{ detail.error.value.message }}</p>

    <template v-else-if="status">
      <!-- Screen-reader announcements for finished runs -->
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>

      <ExperimentHeader
        :status="status"
        :steps="stepStates(status)"
        :live="running && connected"
        :broken-runs="broken"
        :export-csv-url="api.exportUrl(id, 'csv')"
        :export-json-url="api.exportUrl(id, 'json')"
        :retrying="retryBroken.isPending.value"
        :retry-error="retryBroken.error.value?.message ?? null"
        @retry="retryBroken.mutate()"
      />

      <div class="space-y-6">
        <dl class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Runs finished" :value="`${status.runsFinished}/${status.runsTotal}`" :hint="`${passed} passed`" />
          <StatCard
            label="Best mean score"
            :value="best ? formatScore(best.meanScore) : '—'"
            :hint="best ? best.configId : 'after all runs finish'"
          />
          <StatCard
            label="Spend"
            :value="status.agent === 'simulated' ? '$0' : formatUsd(status.spentUsd)"
            :hint="status.agent === 'simulated' ? 'simulated agent' : `estimate ${formatUsd(status.estimatedCostUsd)}`"
          />
          <StatCard label="Broken runs" :value="String(broken)" hint="timeouts & API errors" :tone="broken ? 'warn' : 'default'" />
        </dl>

        <template v-if="report.data.value">
          <PanelCard
            title="Verdicts"
            :subtitle="`Score change of each config vs the baseline config “${report.data.value.baselineConfigId}”`"
          >
            <ForestPlot :rows="forestRows(report.data.value)" :caption="verdictSummary(report.data.value)" />
          </PanelCard>
          <PanelCard title="Results by config" subtitle="Select a config to see its task-by-task changes below" flush>
            <ResultsTable :report="report.data.value" :selected="candidate" @select="(c) => (candidate = c)" />
          </PanelCard>
        </template>

        <!-- Live activity sits beside the task diff only while there is something to show. -->
        <div class="grid gap-6" :class="showActivity ? 'xl:grid-cols-3' : ''">
          <div class="min-w-0" :class="showActivity ? 'xl:col-span-2' : ''">
            <TaskDiffTable
              v-if="report.data.value && counts"
              :report="report.data.value"
              :candidate-id="candidate"
              :filter="filter"
              :rows="rows"
              :counts="counts"
              :experiment-id="id"
              @select-candidate="(c) => (candidate = c)"
              @set-filter="(f) => (filter = f)"
            />
            <PanelCard v-else title="Task diff">
              <p class="text-sm text-ink-500">Appears when every run has been scored.</p>
            </PanelCard>
          </div>
          <PanelCard
            v-if="showActivity"
            title="Live activity"
            :subtitle="running ? (connected ? 'Streaming from Hermes' : 'Connecting…') : 'Last session'"
            flush
          >
            <LiveActivity :items="activity" :experiment-id="id" :connected="connected" />
          </PanelCard>
        </div>

        <PanelCard title="All runs" subtitle="Each chip is one trial with its score. Open one to see what the agent did.">
          <RunGrid :experiment-id="id" :rows="grid" :config-ids="status.configIds" :baseline-config-id="status.baselineConfigId" />
        </PanelCard>
      </div>
    </template>
  </div>
</template>
