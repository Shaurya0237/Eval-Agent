<script setup lang="ts">
/** Configs being compared, then each suite's tasks. */
import type { AgentConfig, DefinitionsResponse } from '@eval-lab/shared';
import { computed } from 'vue';
import AppIcon from '../../../components/ui/AppIcon.vue';
import PanelCard from '../../../components/ui/PanelCard.vue';
import { pickBaseline } from '../definitions.logic';
import ConfigMatrix from './ConfigMatrix.vue';
import TaskList from './TaskList.vue';

const props = defineProps<{ definitions: DefinitionsResponse }>();
const baseline = computed<AgentConfig | undefined>(() => pickBaseline(props.definitions.configs));
</script>

<template>
  <div class="space-y-8">
    <div v-if="definitions.errors.length" role="alert" class="rounded-lg border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
      <p class="flex items-center gap-2 font-medium"><AppIcon name="alert" /> Invalid files</p>
      <ul class="mt-1 list-disc pl-6">
        <li v-for="e in definitions.errors" :key="e.file">
          <code>{{ e.file }}</code
          >: {{ e.message }}
        </li>
      </ul>
    </div>

    <PanelCard
      title="Configs"
      :subtitle="`${definitions.configs.length} versions of the agent. Each changes one thing from the baseline (highlighted).`"
      flush
    >
      <ConfigMatrix :configs="definitions.configs" :baseline="baseline" />
    </PanelCard>

    <section v-for="suite in definitions.suites" :key="suite.id" :aria-labelledby="`suite-${suite.id}`">
      <h2 :id="`suite-${suite.id}`" class="text-lg font-semibold">{{ suite.name }}</h2>
      <p class="mb-4 text-sm text-ink-400">
        {{ suite.description }} {{ suite.tasks.length }} tasks; open one to see the full prompt and how it is checked.
      </p>
      <TaskList :tasks="suite.tasks" :groups="suite.groups ?? {}" />
    </section>
  </div>
</template>
