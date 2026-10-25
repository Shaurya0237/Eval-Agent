<script setup lang="ts">
/** One run: trajectory (left), scoring and workspace files (right). */
import type { RunDetail } from '@eval-lab/shared';
import { computed } from 'vue';
import { describeStep } from '../../../utils/activity';
import AppIcon from '../../../components/ui/AppIcon.vue';
import SimulatedBadge from '../../../components/ui/SimulatedBadge.vue';
import { formatScore, RUN_STATUS_STYLE } from '../../../utils/format';
import type { TimelineEntry } from '../../../components/run/trajectory.logic';
import ScoringPanel from '../../../components/run/ScoringPanel.vue';
import TimelineItem from '../../../components/run/TimelineItem.vue';

const props = defineProps<{
  detail: RunDetail;
  timeline: TimelineEntry[];
  live: boolean;
  openPath: string | null;
  file: { path: string; content: string; truncated: boolean } | undefined;
}>();
const emit = defineEmits<{ openFile: [path: string | null] }>();

const CHANGE_CLASS = { added: 'text-good', modified: 'text-warn', unchanged: 'text-ink-500' } as const;

/** Latest step, announced politely to screen readers while streaming. */
const lastStep = computed(() => {
  const step = props.detail.trajectory.at(-1);
  return props.live && step ? `Agent ${describeStep(step)}` : '';
});
</script>

<template>
  <div class="space-y-5">
    <p class="sr-only" aria-live="polite">{{ lastStep }}</p>
    <header class="card flex flex-wrap items-center gap-3 p-5">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="sr-only">Run summary</h2>
          <span
            v-if="detail.result"
            class="rounded-full border px-2 py-0.5 text-xs"
            :class="RUN_STATUS_STYLE[detail.result.status].className"
            >{{ detail.result.status }}</span
          >
          <span
            v-if="detail.score"
            class="rounded-full border px-2.5 py-0.5 text-sm font-semibold"
            :class="detail.score.passed ? 'border-good/40 bg-good/10 text-good' : 'border-bad/40 bg-bad/10 text-bad'"
            >{{ detail.score.passed ? 'passed' : 'failed' }} · {{ formatScore(detail.score.score) }}</span
          >
          <SimulatedBadge v-if="detail.agent === 'simulated'" />
          <span v-if="live" class="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-2 py-0.5 text-xs font-semibold text-good">
            <span class="live-dot" aria-hidden="true" /> Live: steps appear as Hermes writes them
          </span>
          <span v-else-if="!detail.result" class="text-sm text-accent">running…</span>
        </div>
        <p class="mt-1 text-sm text-ink-400">
          config <span class="font-mono text-ink-200">{{ detail.run.configId }}</span> · trial {{ detail.run.trial }} ·
          <span class="font-mono text-xs">{{ detail.config.model }}</span> · skills {{ detail.config.skills.join(', ') || 'none' }} · memory
          {{ detail.config.memory ? 'seeded' : 'off' }}
        </p>
      </div>
      <RouterLink
        v-if="detail.baselineRunId"
        :to="`/experiments/${detail.experimentId}/compare/${detail.baselineRunId}/${detail.run.runId}`"
        class="btn ml-auto"
      >
        <AppIcon name="split" /> Compare with baseline ({{ detail.baselineConfigId }})
      </RouterLink>
    </header>

    <div class="grid gap-5 lg:grid-cols-5">
      <section class="lg:col-span-3">
        <h2 class="mb-3 flex items-center gap-2 font-semibold"><AppIcon name="execute" class="text-accent" /> What the agent did</h2>
        <p v-if="!timeline.length" class="text-sm text-ink-400">No trajectory recorded yet.</p>
        <ol>
          <TimelineItem v-for="(item, i) in timeline" :key="i" :item="item" :index="i" />
        </ol>
      </section>

      <aside class="space-y-3 lg:col-span-2">
        <h2 class="flex items-center gap-2 font-semibold"><AppIcon name="score" class="text-good" /> Why it scored that way</h2>
        <ScoringPanel :detail="detail" />
        <section class="card p-4">
          <h3 class="font-semibold">Workspace files</h3>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="f in detail.workspace" :key="f.path" class="flex items-center gap-2">
              <button class="font-mono text-accent hover:underline" @click="emit('openFile', openPath === f.path ? null : f.path)">
                {{ f.path }}
              </button>
              <span class="text-xs" :class="CHANGE_CLASS[f.change]">{{ f.change }}</span>
            </li>
          </ul>
          <pre
            v-if="openPath && file"
            class="mt-2 max-h-80 overflow-auto rounded-md bg-ink-800 p-3 font-mono text-xs whitespace-pre-wrap text-ink-300"
            >{{ file.content }}{{ file.truncated ? '\n… (truncated)' : '' }}</pre>
        </section>
        <details class="card p-4 text-xs text-ink-400">
          <summary class="cursor-pointer font-medium text-ink-200">Expected answer (from the task)</summary>
          <pre class="mt-2 overflow-auto font-mono whitespace-pre-wrap">{{ JSON.stringify(detail.task.checks, null, 2) }}</pre>
        </details>
      </aside>
    </div>
  </div>
</template>
