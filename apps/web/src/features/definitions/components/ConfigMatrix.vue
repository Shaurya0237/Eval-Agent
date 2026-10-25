<script setup lang="ts">
/** Configs side by side: only the settings that differ, with changes vs the baseline highlighted. */
import type { AgentConfig } from '@eval-lab/shared';
import { computed } from 'vue';
import { configMatrix } from '../definitions.logic';

const props = defineProps<{ configs: AgentConfig[]; baseline: AgentConfig | undefined }>();
const matrix = computed(() => configMatrix(props.configs, props.baseline));
</script>

<template>
  <div>
    <div class="relative overflow-x-auto">
      <table class="w-full min-w-[36rem] text-sm">
        <caption class="sr-only">
          Settings that differ between configs; changes from the baseline are marked
        </caption>
        <thead class="border-b border-ink-700 bg-ink-850">
          <tr>
            <th scope="col" class="th w-40">Setting</th>
            <th v-for="c in configs" :key="c.id" scope="col" class="px-4 py-3 text-left align-top font-normal">
              <span class="flex items-center gap-2 text-sm font-semibold text-ink-100">
                {{ c.id }}
                <span v-if="c.id === baseline?.id" class="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
                  >baseline</span
                >
              </span>
              <span class="mt-0.5 block text-xs text-ink-400">{{ c.description }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in matrix.differs" :key="row.label" class="border-t border-ink-700">
            <th scope="row" class="td text-left font-medium text-ink-400">{{ row.label }}</th>
            <td v-for="(cell, i) in row.cells" :key="i" class="td">
              <span v-if="cell.changed" class="inline-flex items-center gap-1.5 rounded-md bg-sim/12 px-2 py-0.5 font-medium text-sim">
                {{ cell.value }}<span class="sr-only"> (changed)</span>
              </span>
              <span v-else class="text-ink-300">{{ cell.value }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="matrix.shared.length" class="border-t border-ink-700 px-5 py-3 text-sm text-ink-400">
      <span class="font-medium text-ink-300">Same for every config:</span>
      <template v-for="(s, i) in matrix.shared" :key="s.label">
        {{ i ? ' · ' : ' ' }}{{ s.label.charAt(0).toLowerCase() + s.label.slice(1) }} <span class="text-ink-200">{{ s.value }}</span>
      </template>
    </p>
  </div>
</template>
