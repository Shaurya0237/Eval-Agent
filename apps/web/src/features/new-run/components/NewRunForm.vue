<script setup lang="ts">
/** New-run form; state comes in via props. */
import type { AgentKind, DefinitionsResponse } from '@eval-lab/shared';
import { computed, ref } from 'vue';
import AppIcon from '../../../components/ui/AppIcon.vue';
import { formatUsd } from '../../../utils/format';
import { cliCommand, toggleConfig, type NewRunFormState } from '../newRun.logic';

const props = defineProps<{
  definitions: DefinitionsResponse | undefined;
  form: NewRunFormState;
  formError: string | null;
  estimate: { runs: number; estimatedCostUsd: number } | undefined;
  apiKeyConfigured: boolean;
  launching: boolean;
  launchError: string | null;
}>();
const emit = defineEmits<{ update: [form: NewRunFormState]; launch: [] }>();

const set = (patch: Partial<NewRunFormState>) => emit('update', { ...props.form, ...patch });
const command = computed(() => cliCommand(props.form));
const copied = ref(false);
async function copyCommand(): Promise<void> {
  await navigator.clipboard.writeText(command.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

const AGENTS: { id: AgentKind; label: string }[] = [
  { id: 'hermes', label: 'Hermes' },
  { id: 'simulated', label: 'Simulated' },
];
</script>

<template>
  <form class="card divide-y divide-ink-700" @submit.prevent="emit('launch')">
    <div v-if="definitions?.errors.length" class="bg-bad/5 p-4 text-sm text-bad">
      <p class="font-medium">Invalid definition files (not selectable):</p>
      <ul class="mt-1 list-disc pl-5 font-mono text-xs">
        <li v-for="e in definitions.errors" :key="e.file">{{ e.file }}: {{ e.message }}</li>
      </ul>
    </div>

    <!-- Agent -->
    <div class="grid gap-2 p-5 sm:grid-cols-[10rem_1fr] sm:items-center">
      <span class="text-sm font-medium">Agent</span>
      <div>
        <div class="inline-flex rounded-md border border-ink-600 p-0.5">
          <button
            v-for="a in AGENTS"
            :key="a.id"
            type="button"
            class="rounded px-3 py-1 text-sm transition"
            :class="form.agent === a.id ? 'bg-ink-800 font-medium text-ink-100' : 'text-ink-400 hover:text-ink-100'"
            @click="set({ agent: a.id })"
          >
            {{ a.label }}
          </button>
        </div>
        <p class="mt-1.5 text-xs text-ink-400">
          <template v-if="form.agent === 'hermes'">
            Real Hermes 0.15.2 via OpenAI.
            <span v-if="!apiKeyConfigured" class="text-warn">OPENAI_API_KEY not set in .env.</span>
          </template>
          <template v-else>Scripted stand-in: no model calls, $0. For trying the UI, not for judging configs.</template>
        </p>
      </div>
    </div>

    <!-- Suite / trials / name -->
    <div class="grid gap-4 p-5 sm:grid-cols-[10rem_1fr]">
      <label class="pt-1.5 text-sm font-medium" for="suite">Suite</label>
      <select
        id="suite"
        class="field max-w-sm"
        :value="form.suiteId"
        @change="set({ suiteId: ($event.target as HTMLSelectElement).value })"
      >
        <option value="" disabled>Select…</option>
        <option v-for="s in definitions?.suites ?? []" :key="s.id" :value="s.id">{{ s.id }} ({{ s.taskIds.length }} tasks)</option>
      </select>

      <label class="pt-1.5 text-sm font-medium" for="trials">Trials per task</label>
      <div class="flex items-center gap-3">
        <input
          id="trials"
          type="number"
          min="1"
          max="20"
          class="field w-24 font-mono"
          :value="form.trials"
          @input="set({ trials: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="text-xs text-ink-400">Repeats per task × config. More trials → tighter confidence intervals.</span>
      </div>

      <label class="pt-1.5 text-sm font-medium" for="name">Name <span class="font-normal text-ink-400">(optional)</span></label>
      <input
        id="name"
        class="field max-w-sm"
        placeholder="e.g. gpt-4.1 vs mini"
        :value="form.name"
        @input="set({ name: ($event.target as HTMLInputElement).value })"
      />
    </div>

    <!-- Configs -->
    <div class="p-5">
      <div class="mb-2 flex items-baseline justify-between">
        <span class="text-sm font-medium">Configs</span>
        <span class="text-xs text-ink-400">select ≥ 2 · one is the baseline</span>
      </div>
      <div class="relative overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-700">
              <th class="th w-8"></th>
              <th class="th">Config</th>
              <th class="th">Model</th>
              <th class="th">Skills</th>
              <th class="th">Memory</th>
              <th class="th text-center">Baseline</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in definitions?.configs ?? []"
              :key="c.id"
              class="cursor-pointer border-b border-ink-700 last:border-0 hover:bg-ink-850"
              :class="form.configIds.includes(c.id) ? '' : 'text-ink-400'"
              @click="emit('update', toggleConfig(form, c.id))"
            >
              <td class="td">
                <input
                  type="checkbox"
                  :aria-label="`Include ${c.id}`"
                  class="accent-[var(--accent)]"
                  :checked="form.configIds.includes(c.id)"
                  @click.stop="emit('update', toggleConfig(form, c.id))"
                />
              </td>
              <td class="td font-mono">{{ c.id }}</td>
              <td class="td font-mono text-xs">{{ c.model }}</td>
              <td class="td font-mono text-xs">{{ c.skills.join(', ') || '–' }}</td>
              <td class="td font-mono text-xs">{{ c.memory ? 'seeded' : '–' }}</td>
              <td class="td text-center" @click.stop>
                <input
                  type="radio"
                  :aria-label="`Use ${c.id} as the baseline`"
                  name="baseline"
                  class="accent-[var(--accent)]"
                  :disabled="!form.configIds.includes(c.id)"
                  :checked="form.baselineConfigId === c.id"
                  @change="set({ baselineConfigId: c.id })"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CLI equivalent -->
    <div class="p-5">
      <div class="mb-1.5 flex items-center justify-between">
        <span class="text-xs text-ink-400">Same run from the terminal</span>
        <button type="button" class="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-100" @click="copyCommand">
          <AppIcon name="copy" :size="13" /> {{ copied ? 'copied' : 'copy' }}
        </button>
      </div>
      <pre class="relative overflow-x-auto rounded-md bg-ink-800 px-3 py-2 font-mono text-xs text-ink-200">{{ command }}</pre>
    </div>

    <!-- Submit -->
    <div class="flex flex-wrap items-center gap-4 p-5">
      <button type="submit" class="btn-primary" :disabled="formError !== null || launching">
        <AppIcon name="execute" :size="14" /> {{ launching ? 'Starting…' : 'Start run' }}
      </button>
      <span v-if="formError" class="text-sm text-ink-400">{{ formError }}</span>
      <span v-else-if="estimate" class="font-mono text-sm text-ink-300">
        {{ estimate.runs }} runs · {{ form.agent === 'simulated' ? '$0 (simulated)' : `≈ ${formatUsd(estimate.estimatedCostUsd)}` }}
      </span>
      <span v-if="launchError" class="text-sm text-bad">{{ launchError }}</span>
    </div>
  </form>
</template>
