<script setup lang="ts">
/** One row per config: score, change vs baseline with its 95% CI, verdict, task movement, reliability, cost/time. */
import type { ConfigComparison, MetricComparison, Report } from '@eval-lab/shared';
import VerdictBadge from '../../../components/ui/VerdictBadge.vue';
import { formatDelta, formatPct, formatScore, formatSeconds, formatUsd } from '../../../utils/format';

const props = defineProps<{ report: Report; selected: string }>();
const emit = defineEmits<{ select: [configId: string] }>();

const comparisonOf = (id: string): ConfigComparison | undefined => props.report.comparisons.find((c) => c.configId === id);
const effClass = (m: MetricComparison | undefined) =>
  !m || m.verdict === 'inconclusive' ? 'text-ink-500' : m.verdict === 'better' ? 'text-good' : 'text-bad';
</script>

<template>
  <div class="relative overflow-x-auto">
    <table class="tabular w-full min-w-[48rem] text-sm">
      <caption class="sr-only">
        Results by config compared with the baseline
      </caption>
      <thead class="border-b border-ink-700 bg-ink-850">
        <tr>
          <th scope="col" class="th">Config</th>
          <th scope="col" class="th text-right">Mean score</th>
          <th scope="col" class="th">Change vs baseline</th>
          <th scope="col" class="th">Verdict</th>
          <th scope="col" class="th text-center"><abbr title="tasks improved / regressed / unchanged">Tasks ▲ ▼ =</abbr></th>
          <th scope="col" class="th text-right"><abbr title="share of tasks where every trial passed">All trials pass</abbr></th>
          <th scope="col" class="th text-right">Cost / run</th>
          <th scope="col" class="th text-right">Time / run</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="s in report.configs"
          :key="s.configId"
          class="border-t border-ink-700"
          :class="selected === s.configId ? 'bg-accent-soft/60' : ''"
        >
          <th scope="row" class="td text-left font-medium whitespace-nowrap">
            <button
              v-if="comparisonOf(s.configId)"
              type="button"
              class="cursor-pointer text-left hover:text-accent hover:underline"
              :aria-pressed="selected === s.configId"
              :title="`Show ${s.configId} in the task diff`"
              @click="emit('select', s.configId)"
            >
              {{ s.configId }}
            </button>
            <span v-else>{{ s.configId }} <span class="ml-1 text-xs font-normal text-ink-500">baseline</span></span>
          </th>
          <td class="td text-right font-semibold">{{ formatScore(s.meanScore) }}</td>
          <template v-if="comparisonOf(s.configId)">
            <td class="td whitespace-nowrap">
              <span
                class="font-semibold"
                :class="{ 'text-good': comparisonOf(s.configId)!.score.delta > 0, 'text-bad': comparisonOf(s.configId)!.score.delta < 0 }"
              >
                {{ formatDelta('score', comparisonOf(s.configId)!.score.delta) }}
              </span>
              <span class="ml-1.5 text-xs text-ink-500">
                95% CI {{ formatDelta('score', comparisonOf(s.configId)!.score.ciLow) }} to
                {{ formatDelta('score', comparisonOf(s.configId)!.score.ciHigh) }}
              </span>
            </td>
            <td class="td">
              <VerdictBadge :verdict="comparisonOf(s.configId)!.score.verdict" />
              <p v-if="comparisonOf(s.configId)!.score.verdict === 'inconclusive'" class="mt-0.5 text-xs text-ink-500">
                {{
                  comparisonOf(s.configId)!.trialsToResolve
                    ? `≈${comparisonOf(s.configId)!.trialsToResolve} trials/task may settle it`
                    : 'no meaningful difference'
                }}
              </p>
            </td>
            <td class="td text-center whitespace-nowrap">
              <span class="text-good">{{ comparisonOf(s.configId)!.improved }}</span>
              <span class="mx-1 text-ink-600" aria-hidden="true">·</span>
              <span class="text-bad">{{ comparisonOf(s.configId)!.regressed }}</span>
              <span class="mx-1 text-ink-600" aria-hidden="true">·</span>
              <span class="text-ink-400">{{ comparisonOf(s.configId)!.unchanged }}</span>
            </td>
          </template>
          <td v-else class="td text-ink-500" colspan="3">the reference every other config is compared with</td>
          <td class="td text-right">{{ formatPct(s.passAllRate) }}</td>
          <td class="td text-right">
            {{ formatUsd(s.meanCostUsd) }}
            <div v-if="comparisonOf(s.configId)" class="text-xs" :class="effClass(comparisonOf(s.configId)?.costUsd)">
              {{ formatDelta('costUsd', comparisonOf(s.configId)!.costUsd.delta) }}
            </div>
          </td>
          <td class="td text-right">
            {{ formatSeconds(s.meanDurationMs) }}
            <div v-if="comparisonOf(s.configId)" class="text-xs" :class="effClass(comparisonOf(s.configId)?.durationMs)">
              {{ formatDelta('durationMs', comparisonOf(s.configId)!.durationMs.delta) }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
