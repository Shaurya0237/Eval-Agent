<script setup lang="ts">
import type { Verdict } from '@eval-lab/shared';

defineProps<{ verdict: Verdict; size?: 'sm' | 'lg' }>();

const STYLE: Record<Verdict, { label: string; cls: string }> = {
  better: { label: '▲ better', cls: 'border-good/40 bg-good/10 text-good' },
  worse: { label: '▼ worse', cls: 'border-bad/40 bg-bad/10 text-bad' },
  inconclusive: { label: '≈ inconclusive', cls: 'border-ink-600 bg-ink-800 text-ink-300' },
};
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border font-semibold whitespace-nowrap"
    :class="[STYLE[verdict].cls, size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs']"
  >
    {{ STYLE[verdict].label }}
  </span>
</template>
