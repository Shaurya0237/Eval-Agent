<script setup lang="ts">
/** Task-by-task diff of one config vs the baseline, most-regressed first, filterable. */
import type { Report, TaskCell } from '@eval-lab/shared';
import { useId } from 'vue';
import { formatDelta, formatScore, scoreChipClass } from '../../../utils/format';
import { deltaBar, DIFF_FILTERS, type DiffFilter, type DiffRow } from '../experimentDetail.logic';

defineProps<{
  report: Report;
  candidateId: string;
  filter: DiffFilter;
  rows: DiffRow[];
  counts: Record<DiffFilter, number>;
  experimentId: string;
}>();
const emit = defineEmits<{ selectCandidate: [id: string]; setFilter: [f: DiffFilter] }>();
const headingId = useId();
const selectId = useId();

/** Compare link for the first trial (baseline left, candidate right). */
const compareLink = (id: string, baseline: TaskCell, candidate: TaskCell) =>
  baseline.runs[0] && candidate.runs[0] ? `/experiments/${id}/compare/${baseline.runs[0].runId}/${candidate.runs[0].runId}` : '';
const trialLabel = (r: TaskCell['runs'][number]) =>
  `trial ${r.trial}: ${r.runStatus === 'done' ? (r.passed ? 'passed' : 'failed') : r.runStatus}, score ${r.score.toFixed(2)}`;
</script>

<template>
  <section class="card" :aria-labelledby="headingId">
    <header class="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ink-700 px-5 py-3.5">
      <h2 :id="headingId" class="text-base font-semibold">Task diff</h2>
      <div class="flex items-center gap-2">
        <label :for="selectId" class="text-sm text-ink-400">Config</label>
        <select
          :id="selectId"
          class="field min-h-9 w-auto py-1 text-sm"
          :value="candidateId"
          @change="emit('selectCandidate', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="c in report.comparisons" :key="c.configId" :value="c.configId">{{ c.configId }}</option>
        </select>
        <span class="text-sm text-ink-500">vs {{ report.baselineConfigId }}</span>
      </div>
      <div role="group" aria-label="Filter tasks" class="flex flex-wrap gap-1 xl:ml-auto">
        <button
          v-for="f in DIFF_FILTERS"
          :key="f"
          type="button"
          class="min-h-8 cursor-pointer rounded-md px-2.5 text-sm capitalize transition-colors"
          :class="filter === f ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
          :aria-pressed="filter === f"
          @click="emit('setFilter', f)"
        >
          {{ f }} <span class="tabular text-xs">{{ counts[f] }}</span>
        </button>
      </div>
    </header>

    <div class="relative overflow-x-auto">
      <table class="w-full min-w-[40rem] text-sm">
        <caption class="sr-only">
          Tasks for
          {{
            candidateId
          }}
          compared with
          {{
            report.baselineConfigId
          }}, most regressed first
        </caption>
        <thead class="border-b border-ink-700 bg-ink-850">
          <tr>
            <th scope="col" class="th">Task</th>
            <th scope="col" class="th">{{ report.baselineConfigId }}</th>
            <th scope="col" class="th">{{ candidateId }}</th>
            <th scope="col" class="th w-56">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td class="td text-ink-500" colspan="4">No tasks match this filter.</td>
          </tr>
          <tr v-for="row in rows" :key="row.diff.taskId" class="border-t border-ink-700 hover:bg-ink-850">
            <th scope="row" class="td text-left font-normal">
              <RouterLink
                :to="compareLink(experimentId, row.baseline, row.candidate)"
                class="text-sm whitespace-nowrap text-ink-100 hover:text-accent hover:underline"
                :title="`Compare ${row.diff.taskId} side by side`"
              >
                {{ row.diff.taskId }}
              </RouterLink>
            </th>
            <td v-for="cell in [row.baseline, row.candidate]" :key="cell.configId" class="td">
              <div class="flex items-center gap-1">
                <span
                  v-for="r in cell.runs"
                  :key="r.runId"
                  role="img"
                  :aria-label="trialLabel(r)"
                  :title="trialLabel(r)"
                  class="h-4 w-6 rounded border"
                  :class="scoreChipClass(r.score, r.runStatus)"
                />
                <span class="tabular ml-2 text-xs text-ink-400">{{ formatScore(cell.meanScore) }}</span>
              </div>
            </td>
            <td class="td">
              <div class="flex items-center gap-3">
                <span
                  class="tabular w-16 text-right text-sm whitespace-nowrap"
                  :class="{
                    'text-good': row.diff.change === 'improved',
                    'text-bad': row.diff.change === 'regressed',
                    'text-ink-500': row.diff.change === 'unchanged',
                  }"
                >
                  <span aria-hidden="true">{{ row.diff.change === 'improved' ? '▲' : row.diff.change === 'regressed' ? '▼' : '' }}</span>
                  {{ formatDelta('score', row.diff.delta) }}<span class="sr-only">, {{ row.diff.change }}</span>
                </span>
                <div class="relative h-2 flex-1 rounded-full bg-ink-800" aria-hidden="true">
                  <div class="absolute top-0 left-1/2 h-2 w-px bg-ink-500" />
                  <div
                    class="absolute top-0 h-2 animate-grow-x rounded-full"
                    :class="row.diff.delta >= 0 ? 'origin-left bg-good' : 'origin-right bg-bad'"
                    :style="deltaBar(row.diff.delta)"
                  />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="border-t border-ink-700 px-5 py-3 text-xs text-ink-500">
      Each square is one trial: green passed, red wrong, amber broken (timeout or API error). Select a task to compare both configs side by
      side.
    </p>
  </section>
</template>
