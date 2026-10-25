<script setup lang="ts">
/** Experiment status as icon + text. */
import type { ExperimentStatus } from '@eval-lab/shared';
import AppIcon, { type IconName } from './AppIcon.vue';

defineProps<{ status: ExperimentStatus }>();
const STYLE: Record<ExperimentStatus, { cls: string; icon: IconName }> = {
  running: { cls: 'bg-accent-soft text-accent', icon: 'activity' },
  completed: { cls: 'bg-good/10 text-good', icon: 'check' },
  failed: { cls: 'bg-bad/10 text-bad', icon: 'alert' },
};
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="STYLE[status].cls">
    <AppIcon :name="STYLE[status].icon" :size="12" />
    {{ status }}
  </span>
</template>
