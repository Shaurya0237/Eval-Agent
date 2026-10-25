<script setup lang="ts">
/** A suite's tasks, grouped by kind: one line each (question + expected answer); details on expand. */
import type { Task } from '@eval-lab/shared';
import { computed } from 'vue';
import AppIcon from '../../../components/ui/AppIcon.vue';
import { describeCheck, expectedAnswer, groupTasks, shortQuestion } from '../definitions.logic';

const props = defineProps<{ tasks: Task[]; groups: Record<string, string> }>();
const grouped = computed(() => groupTasks(props.tasks, props.groups));

const PROCESS_LABEL: Record<string, string> = {
  read_inputs: 'read the input files',
  used_skill: 'loaded a skill',
  tool_errors: 'tool errors',
  hit_turn_limit: 'turn limit reached',
};
</script>

<template>
  <div class="space-y-6">
    <section v-for="g in grouped" :key="g.key" :aria-label="g.label">
      <h3 class="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink-200">
        {{ g.label }} <span class="text-xs font-normal text-ink-500">{{ g.tasks.length }} tasks</span>
      </h3>
      <ul class="card divide-y divide-ink-700 overflow-hidden">
        <li v-for="t in g.tasks" :key="t.id">
          <details class="group">
            <summary
              class="grid cursor-pointer list-none grid-cols-[1rem_1fr] gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-ink-850 sm:grid-cols-[1rem_1fr_auto] [&::-webkit-details-marker]:hidden"
            >
              <AppIcon name="chevron" :size="16" class="mt-0.5 text-ink-500 transition-transform group-open:rotate-90" />
              <span class="min-w-0">
                <span class="block text-ink-100">{{ shortQuestion(t.prompt) }}</span>
                <span class="text-xs text-ink-500">{{ t.id }}</span>
              </span>
              <span class="col-start-2 flex flex-wrap gap-1.5 sm:col-start-3 sm:justify-end sm:self-center">
                <span class="sr-only">Expected answer:</span>
                <span
                  v-for="a in expectedAnswer(t)"
                  :key="a"
                  class="rounded-md border border-good/30 bg-good/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-good"
                  >{{ a }}</span
                >
              </span>
            </summary>

            <div class="space-y-3 border-t border-ink-700 bg-ink-850 px-4 py-4 text-sm sm:pl-11">
              <div>
                <div class="label-xs">Full prompt sent to the agent</div>
                <p class="mt-1 whitespace-pre-line text-ink-300">{{ t.prompt.trim() }}</p>
              </div>
              <div>
                <div class="label-xs">Passes when</div>
                <ul class="mt-1 list-disc space-y-0.5 pl-5 text-ink-300">
                  <li v-for="(c, j) in t.checks" :key="j">{{ describeCheck(c) }}</li>
                </ul>
              </div>
              <dl class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-400">
                <div>
                  <dt class="inline">Input files:</dt>
                  <dd class="inline text-ink-300">{{ t.fixtures }}</dd>
                </div>
                <div>
                  <dt class="inline">Time limit:</dt>
                  <dd class="inline text-ink-300">{{ t.timeoutSec }}s</dd>
                </div>
                <div>
                  <dt class="inline">Also flags (not scored):</dt>
                  <dd class="inline text-ink-300">{{ t.processChecks.map((p) => PROCESS_LABEL[p] ?? p).join(', ') || 'nothing' }}</dd>
                </div>
              </dl>
            </div>
          </details>
        </li>
      </ul>
    </section>
  </div>
</template>
