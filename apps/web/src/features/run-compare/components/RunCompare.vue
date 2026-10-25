<script setup lang="ts">
/** Two runs of one task side by side: answers, checks, metrics, tools, trajectory. */
import type { RunDetail } from '@eval-lab/shared';
import { computed } from 'vue';
import AppIcon from '../../../components/ui/AppIcon.vue';
import SimulatedBadge from '../../../components/ui/SimulatedBadge.vue';
import ScoringPanel from '../../../components/run/ScoringPanel.vue';
import type { TimelineEntry } from '../../../components/run/trajectory.logic';
import TimelineItem from '../../../components/run/TimelineItem.vue';
import { compareMetrics, toolPath } from '../runCompare.logic';

const props = defineProps<{ left: RunDetail; right: RunDetail; leftTimeline: TimelineEntry[]; rightTimeline: TimelineEntry[] }>();
const metrics = computed(() => compareMetrics(props.left, props.right));
const sides = computed(() => [
  { key: 'left' as const, detail: props.left, timeline: props.leftTimeline },
  { key: 'right' as const, detail: props.right, timeline: props.rightTimeline },
]);
</script>

<template>
  <div class="space-y-5">
    <p class="flex flex-wrap items-center gap-2 text-ink-400">
      Trial {{ left.run.trial }} of <span class="font-mono text-ink-200">{{ left.run.configId }}</span> vs trial {{ right.run.trial }} of
      <span class="font-mono text-ink-200">{{ right.run.configId }}</span>
      <SimulatedBadge v-if="left.agent === 'simulated'" />
    </p>

    <!-- Headline numbers -->
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-ink-700">
            <th class="label-xs px-4 py-3 text-left">metric</th>
            <th class="px-4 py-3 text-right font-mono text-sm">{{ left.run.configId }}</th>
            <th class="px-4 py-3 text-right font-mono text-sm">{{ right.run.configId }}</th>
          </tr>
        </thead>
        <tbody class="font-mono">
          <tr v-for="m in metrics" :key="m.label" class="border-t border-ink-700/60">
            <td class="px-4 py-2 font-sans text-ink-400">{{ m.label }}</td>
            <td class="px-4 py-2 text-right" :class="m.winner === 'left' ? 'text-good' : ''">
              {{ m.left }}<span v-if="m.winner === 'left'"> ●</span>
            </td>
            <td class="px-4 py-2 text-right" :class="m.winner === 'right' ? 'text-good' : ''">
              {{ m.right }}<span v-if="m.winner === 'right'"> ●</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Two columns -->
    <div class="grid gap-5 lg:grid-cols-2">
      <section v-for="side in sides" :key="side.key" class="space-y-3">
        <div class="card flex items-center gap-3 p-4" :class="side.detail.score?.passed ? 'border-good/40' : 'border-bad/40'">
          <span class="text-2xl" :class="side.detail.score?.passed ? 'text-good' : 'text-bad'">{{
            side.detail.score?.passed ? '✓' : '✗'
          }}</span>
          <div class="min-w-0">
            <div class="font-mono font-semibold">{{ side.detail.run.configId }}</div>
            <div class="truncate text-xs text-ink-400">
              {{ side.detail.config.model }} · skills {{ side.detail.config.skills.join(', ') || 'none' }} · memory
              {{ side.detail.config.memory ? 'seeded' : 'off' }}
            </div>
          </div>
          <RouterLink :to="`/experiments/${side.detail.experimentId}/runs/${side.detail.run.runId}`" class="btn ml-auto shrink-0"
            ><AppIcon name="eye" /> Open</RouterLink
          >
        </div>

        <div class="card p-4">
          <div class="label-xs">final answer</div>
          <p class="mt-1 font-mono text-sm whitespace-pre-wrap" :class="side.detail.score?.passed ? 'text-good' : 'text-bad'">
            {{ side.detail.result?.finalAnswer || '(no answer)' }}
          </p>
          <div class="mt-3 label-xs">tool path</div>
          <div class="mt-1 flex flex-wrap items-center gap-1 font-mono text-[11px]">
            <template v-for="(t, i) in toolPath(side.detail)" :key="i">
              <span class="rounded bg-accent/10 px-1.5 py-0.5 text-accent" :class="t === 'skill_view' ? '!bg-sim/15 !text-sim' : ''">{{
                t
              }}</span>
              <span v-if="i < toolPath(side.detail).length - 1" class="text-ink-600">→</span>
            </template>
            <span v-if="!toolPath(side.detail).length" class="text-ink-400">no tool calls</span>
          </div>
        </div>

        <ScoringPanel :detail="side.detail" />

        <details class="card p-4" open>
          <summary class="cursor-pointer font-medium">Trajectory · {{ side.timeline.length }} steps</summary>
          <ol class="mt-3">
            <TimelineItem v-for="(item, i) in side.timeline" :key="i" :item="item" :index="i" />
          </ol>
        </details>
      </section>
    </div>
  </div>
</template>
