<script setup lang="ts">
/**
 * Forest plot: each config's score Δ vs the baseline with its 95% CI, on one shared axis.
 * Identity is the row label; verdict is shown as text + icon, never colour alone.
 */
import type { Verdict } from '@eval-lab/shared';
import { computed } from 'vue';

export interface ForestRow {
  label: string;
  delta: number;
  ciLow: number;
  ciHigh: number;
  verdict: Verdict;
}

const props = defineProps<{ rows: ForestRow[]; caption: string }>();

/** Symmetric axis that fits every interval, rounded to a readable step. */
const range = computed(() => {
  const max = Math.max(0.2, ...props.rows.flatMap((r) => [Math.abs(r.ciLow), Math.abs(r.ciHigh), Math.abs(r.delta)]));
  return [0.2, 0.4, 0.6, 0.8, 1].find((s) => s >= max) ?? 1;
});
const pct = (v: number) => `${((Math.max(-range.value, Math.min(range.value, v)) + range.value) / (2 * range.value)) * 100}%`;
const ticks = computed(() => [-1, -0.5, 0, 0.5, 1].map((t) => t * range.value));

const TONE: Record<Verdict, { bar: string; text: string; icon: string; label: string }> = {
  better: { bar: 'bg-good', text: 'text-good', icon: '▲', label: 'better' },
  worse: { bar: 'bg-bad', text: 'text-bad', icon: '▼', label: 'worse' },
  inconclusive: { bar: 'bg-ink-500', text: 'text-ink-400', icon: '≈', label: 'inconclusive' },
};
const fmt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(2)}`;
</script>

<template>
  <figure>
    <figcaption class="sr-only">{{ caption }}</figcaption>
    <ul class="space-y-1">
      <li
        v-for="row in rows"
        :key="row.label"
        class="grid grid-cols-[1fr_6.5rem] sm:grid-cols-[minmax(6rem,9rem)_1fr_7rem] items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-850"
        tabindex="0"
        :aria-label="`${row.label}: change ${fmt(row.delta)}, 95% interval ${fmt(row.ciLow)} to ${fmt(row.ciHigh)}, ${TONE[row.verdict].label}`"
        :title="`Δ ${fmt(row.delta)} · 95% CI [${fmt(row.ciLow)}, ${fmt(row.ciHigh)}]`"
      >
        <span class="col-span-2 truncate text-sm font-medium text-ink-200 sm:col-span-1">{{ row.label }}</span>
        <div class="relative h-6" aria-hidden="true">
          <div class="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
          <div
            class="absolute top-1/2 h-[3px] -translate-y-1/2 animate-grow-x rounded-full"
            :class="TONE[row.verdict].bar"
            :style="{ left: pct(row.ciLow), width: `calc(${pct(row.ciHigh)} - ${pct(row.ciLow)})` }"
          />
          <div
            class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900"
            :class="TONE[row.verdict].bar"
            :style="{ left: pct(row.delta) }"
          />
        </div>
        <span class="text-sm font-medium whitespace-nowrap" :class="TONE[row.verdict].text">
          <span aria-hidden="true">{{ TONE[row.verdict].icon }}</span> {{ TONE[row.verdict].label }}
        </span>
      </li>
    </ul>
    <!-- Axis -->
    <div class="mt-1 grid grid-cols-[1fr_6.5rem] sm:grid-cols-[minmax(6rem,9rem)_1fr_7rem] gap-3 px-2" aria-hidden="true">
      <span class="hidden sm:block" />
      <div class="relative h-5 border-t border-ink-600">
        <span
          v-for="(t, i) in ticks"
          :key="t"
          class="absolute top-1 -translate-x-1/2 font-mono text-[11px] text-ink-500"
          :class="i % 2 === 1 ? 'hidden sm:inline' : ''"
          :style="{ left: pct(t) }"
          >{{ fmt(t) }}</span
        >
      </div>
      <span />
    </div>
    <p class="mt-2 px-2 text-xs text-ink-500">
      Score change vs baseline. Line = 95% confidence interval, dot = observed change, centre line = no change.
    </p>
  </figure>
</template>
