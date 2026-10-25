<script setup lang="ts">
/** Live feed of agent steps across all in-flight runs (newest first). */
import type { ActivityItem } from '../../../utils/activity';

defineProps<{ items: ActivityItem[]; experimentId: string; connected: boolean }>();

const KIND: Record<ActivityItem['kind'], string> = {
  started: 'text-accent',
  step: 'text-ink-400',
  passed: 'text-good',
  failed: 'text-bad',
  broken: 'text-warn',
};
const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
</script>

<template>
  <div>
    <p v-if="!items.length" class="px-5 py-6 text-sm text-ink-500">
      {{ connected ? 'Waiting for the agent’s first step…' : 'Activity appears here while runs execute.' }}
    </p>
    <TransitionGroup
      v-else
      tag="ol"
      name="feed"
      class="max-h-[28rem] divide-y divide-ink-700 overflow-y-auto"
      aria-label="Recent agent steps"
    >
      <li v-for="item in items" :key="item.id" class="px-5 py-2.5 text-sm">
        <div class="flex items-baseline justify-between gap-3">
          <RouterLink
            :to="`/experiments/${experimentId}/runs/${item.runId}`"
            class="truncate font-mono text-xs text-ink-300 hover:text-accent hover:underline"
          >
            {{ item.run.taskId }} · {{ item.run.configId }} · t{{ item.run.trial }}
          </RouterLink>
          <time class="shrink-0 font-mono text-xs text-ink-500">{{ time(item.at) }}</time>
        </div>
        <p :class="KIND[item.kind]">{{ item.text }}</p>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.feed-enter-active {
  transition: all 220ms ease-out;
}
.feed-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
