<script setup lang="ts">
/** KPI tile: label, big value, optional hint. */
defineProps<{ label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }>();
const TONE = { default: 'text-ink-100', good: 'text-good', bad: 'text-bad', warn: 'text-warn' } as const;
</script>

<template>
  <div class="card px-5 py-4">
    <dt class="text-sm text-ink-400">{{ label }}</dt>
    <dd class="mt-1 tabular text-2xl font-semibold tracking-tight" :class="TONE[tone ?? 'default']">{{ value }}</dd>
    <dd v-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</dd>
  </div>
</template>
