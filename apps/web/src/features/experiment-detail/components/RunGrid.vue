<script setup lang="ts">
/** Every run as a chip (task × config × trial); chips update live and link to the run. */
import { scoreChipClass } from '../../../utils/format';
import type { GridRow } from '../experimentDetail.logic';

defineProps<{ experimentId: string; rows: GridRow[]; configIds: string[]; baselineConfigId: string }>();

type Run = GridRow['cells'][number]['runs'][number];
const chipText = (r: Run) =>
  r.status === 'pending'
    ? '·'
    : r.status === 'running'
      ? '···'
      : r.status === 'done'
        ? (r.score ?? 0).toFixed(2)
        : r.status === 'timeout'
          ? 't/o'
          : 'err';
const chipLabel = (taskId: string, configId: string, r: Run) =>
  `${taskId}, ${configId}, trial ${r.trial}: ${r.status === 'done' ? `${r.passed ? 'passed' : 'failed'}, score ${(r.score ?? 0).toFixed(2)}` : r.status}`;
</script>

<template>
  <div class="relative overflow-x-auto">
    <table class="w-full min-w-[36rem] text-sm">
      <caption class="sr-only">
        All runs by task and config
      </caption>
      <thead>
        <tr>
          <th scope="col" class="th pl-0">Task</th>
          <th v-for="c in configIds" :key="c" scope="col" class="th normal-case">
            {{ c }}<span v-if="c === baselineConfigId" class="ml-1 text-[11px] text-accent">baseline</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.taskId" class="border-t border-ink-700">
          <th scope="row" class="py-2.5 pr-4 text-left text-sm font-normal whitespace-nowrap text-ink-300">{{ row.taskId }}</th>
          <td v-for="cell in row.cells" :key="cell.configId" class="px-4 py-2.5">
            <div class="flex gap-1.5">
              <RouterLink
                v-for="r in cell.runs"
                :key="`${r.runId}:${r.status}`"
                :to="`/experiments/${experimentId}/runs/${r.runId}`"
                class="inline-flex h-8 min-w-12 animate-pop items-center justify-center rounded-md border px-1.5 tabular text-xs transition-shadow hover:ring-2 hover:ring-ink-500"
                :class="scoreChipClass(r.score, r.status)"
                :aria-label="chipLabel(row.taskId, cell.configId, r)"
                :title="chipLabel(row.taskId, cell.configId, r)"
              >
                {{ chipText(r) }}
              </RouterLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-400" aria-label="Legend">
      <li class="flex items-center gap-1.5"><span class="h-3.5 w-5 rounded border" :class="scoreChipClass(1, 'done')" /> passed (1.00)</li>
      <li class="flex items-center gap-1.5"><span class="h-3.5 w-5 rounded border" :class="scoreChipClass(0.5, 'done')" /> partial</li>
      <li class="flex items-center gap-1.5"><span class="h-3.5 w-5 rounded border" :class="scoreChipClass(0, 'done')" /> wrong (0.00)</li>
      <li class="flex items-center gap-1.5">
        <span class="h-3.5 w-5 rounded border" :class="scoreChipClass(null, 'error')" /> broken (err / t/o)
      </li>
      <li class="flex items-center gap-1.5">
        <span class="h-3.5 w-5 rounded border" :class="scoreChipClass(null, 'running')" /> running (···)
      </li>
    </ul>
  </div>
</template>
