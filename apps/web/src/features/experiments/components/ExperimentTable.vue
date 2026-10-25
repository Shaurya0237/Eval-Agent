<script setup lang="ts">
/** Experiments list: a table on wide screens, stacked cards on phones. */
import type { ExperimentStatusFile } from '@eval-lab/shared';
import AppIcon from '../../../components/ui/AppIcon.vue';
import SimulatedBadge from '../../../components/ui/SimulatedBadge.vue';
import StatusBadge from '../../../components/ui/StatusBadge.vue';
import { formatDate, formatUsd } from '../../../utils/format';
import { progressOf } from '../experiments.logic';

defineProps<{ experiments: ExperimentStatusFile[] | undefined; loading: boolean }>();
const cost = (e: ExperimentStatusFile) => (e.agent === 'simulated' ? '$0' : formatUsd(e.spentUsd));
</script>

<template>
  <p v-if="loading" class="px-5 py-6 text-ink-400">Loading experiments…</p>
  <div v-else-if="!experiments?.length" class="px-5 py-10 text-center">
    <p class="text-ink-300">No experiments yet.</p>
    <RouterLink to="/new" class="btn-primary mt-3"><AppIcon name="plus" :size="16" /> Start your first run</RouterLink>
  </div>

  <template v-else>
    <!-- ≥ md: table -->
    <div class="relative hidden overflow-x-auto md:block">
      <table class="w-full text-sm">
        <caption class="sr-only">
          Experiments, newest first
        </caption>
        <thead class="border-b border-ink-700 bg-ink-850">
          <tr>
            <th scope="col" class="th">Name</th>
            <th scope="col" class="th">Status</th>
            <th scope="col" class="th">Configs</th>
            <th scope="col" class="th text-right">Runs</th>
            <th scope="col" class="th text-right">Cost</th>
            <th scope="col" class="th text-right">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in experiments" :key="e.id" class="border-t border-ink-700 transition-colors hover:bg-ink-850">
            <td class="td">
              <div class="flex items-center gap-2">
                <RouterLink :to="`/experiments/${e.id}`" class="font-medium text-ink-100 hover:text-accent hover:underline">{{
                  e.name
                }}</RouterLink>
                <SimulatedBadge v-if="e.agent === 'simulated'" />
              </div>
              <div class="tabular text-xs text-ink-500">{{ e.suiteId }} · {{ e.trials }} trials</div>
            </td>
            <td class="td">
              <StatusBadge :status="e.status" />
              <div
                v-if="e.status === 'running'"
                class="mt-1.5 h-1 w-28 overflow-hidden rounded bg-ink-800"
                role="progressbar"
                :aria-valuenow="Math.round(progressOf(e) * 100)"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`${e.name} progress`"
              >
                <div class="h-full bg-accent transition-[width] duration-700" :style="{ width: `${Math.round(progressOf(e) * 100)}%` }" />
              </div>
            </td>
            <td class="td text-ink-400">
              <span class="text-ink-200">{{ e.baselineConfigId }}</span>
              <template v-for="c in e.configIds.filter((x) => x !== e.baselineConfigId)" :key="c"> · {{ c }}</template>
            </td>
            <td class="td text-right tabular">{{ e.runsFinished }}/{{ e.runsTotal }}</td>
            <td class="td text-right tabular">{{ cost(e) }}</td>
            <td class="td text-right whitespace-nowrap text-ink-400">{{ formatDate(e.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- < md: cards -->
    <ul class="divide-y divide-ink-700 md:hidden">
      <li v-for="e in experiments" :key="e.id" class="px-5 py-4">
        <div class="flex items-start justify-between gap-3">
          <RouterLink :to="`/experiments/${e.id}`" class="font-medium text-ink-100 hover:text-accent">{{ e.name }}</RouterLink>
          <StatusBadge :status="e.status" />
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-400">
          <SimulatedBadge v-if="e.agent === 'simulated'" />
          <span class="tabular">{{ e.runsFinished }}/{{ e.runsTotal }} runs</span>
          <span class="tabular">{{ cost(e) }}</span>
          <span>{{ formatDate(e.createdAt) }}</span>
        </div>
      </li>
    </ul>
  </template>
</template>
