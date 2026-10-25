<script setup lang="ts">
/** Animated diagram of the 6 pipeline steps and the file each writes. */
import AppIcon, { type IconName } from '../ui/AppIcon.vue';

const STEPS: { icon: IconName; title: string; blurb: string; file: string }[] = [
  { icon: 'load', title: 'Load', blurb: 'validate + freeze YAML', file: '1-definitions.json' },
  { icon: 'plan', title: 'Plan', blurb: 'tasks × configs × trials', file: '2-plan.json' },
  { icon: 'prepare', title: 'Prepare', blurb: 'private HERMES_HOME per run', file: 'runs/*/home' },
  { icon: 'execute', title: 'Execute', blurb: 'run Hermes, record each step', file: 'trajectory.jsonl' },
  { icon: 'score', title: 'Score', blurb: 'outcome · efficiency · process', file: '5-scores.json' },
  { icon: 'compare', title: 'Compare', blurb: 'paired bootstrap → verdict', file: '6-report.json' },
];
</script>

<template>
  <ol class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
    <li v-for="(s, i) in STEPS" :key="s.title" class="relative flex flex-col items-center text-center">
      <!-- connector + comet (desktop) -->
      <div v-if="i < STEPS.length - 1" class="flow-line absolute top-6 left-[calc(50%+1.75rem)] hidden h-px w-[calc(100%-3.5rem)] lg:block">
        <span
          v-for="p in 2"
          :key="p"
          class="flow-comet"
          :style="{ animation: `travel 2.6s cubic-bezier(0.45, 0, 0.55, 1) ${(i * 0.45 + (p - 1) * 1.3).toFixed(2)}s infinite` }"
        />
      </div>
      <div
        class="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 text-accent shadow-sm"
      >
        <AppIcon :name="s.icon" :size="20" />
        <span
          class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full border border-ink-600 bg-ink-900 font-mono text-[10px] text-ink-300"
        >
          {{ i + 1 }}
        </span>
      </div>
      <div class="mt-2 text-sm font-semibold">{{ s.title }}</div>
      <div class="max-w-36 text-xs text-ink-400">{{ s.blurb }}</div>
      <code class="mt-1 font-mono text-[10px] text-ink-500">{{ s.file }}</code>
    </li>
  </ol>
</template>
