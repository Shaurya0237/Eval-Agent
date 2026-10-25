<script setup lang="ts">
/** Page: run inspector (streams new steps live while the run executes). */
import { computed, toRef } from 'vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import { useExperimentStream } from '../../composables/useExperimentStream';
import { parseRunId } from '../../utils/activity';
import RunInspector from './components/RunInspector.vue';
import { useRunInspector } from './composables/useRunInspector';

const props = defineProps<{ id: string; runId: string }>();
const id = toRef(props, 'id');
const { run, timeline, openPath, file } = useRunInspector(id, toRef(props, 'runId'));

// Stream while this run hasn't finished; steps are appended to the cached run detail.
const live = computed(() => !!run.data.value && !run.data.value.score);
const { connected } = useExperimentStream(id, live);
const ref = computed(() => parseRunId(props.runId));
</script>

<template>
  <div>
    <PageHeader
      :title="ref.taskId"
      :breadcrumbs="[
        { label: 'Overview', to: '/' },
        { label: 'Experiment', to: `/experiments/${id}` },
        { label: `${ref.configId} · trial ${ref.trial}` },
      ]"
    />
    <p v-if="run.isLoading.value" class="text-ink-400">Loading run…</p>
    <p v-else-if="run.error.value" role="alert" class="text-bad">{{ run.error.value.message }}</p>
    <RunInspector
      v-else-if="run.data.value"
      :detail="run.data.value"
      :timeline="timeline"
      :live="live && connected"
      :open-path="openPath"
      :file="file.data.value"
      @open-file="(p) => (openPath = p)"
    />
  </div>
</template>
