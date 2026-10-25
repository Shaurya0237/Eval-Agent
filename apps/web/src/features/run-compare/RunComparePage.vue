<script setup lang="ts">
/** Page: compare two runs side by side. */
import { computed, toRef } from 'vue';
import PageHeader from '../../components/ui/PageHeader.vue';
import { parseRunId } from '../../utils/activity';
import RunCompare from './components/RunCompare.vue';
import { useRunCompare } from './composables/useRunCompare';

const props = defineProps<{ id: string; left: string; right: string }>();
const { left, right, leftTimeline, rightTimeline } = useRunCompare(toRef(props, 'id'), toRef(props, 'left'), toRef(props, 'right'));
const task = computed(() => parseRunId(props.left).taskId);
</script>

<template>
  <div>
    <PageHeader
      :title="`Compare · ${task}`"
      :breadcrumbs="[{ label: 'Overview', to: '/' }, { label: 'Experiment', to: `/experiments/${id}` }, { label: 'Compare runs' }]"
    />
    <p v-if="left.isLoading.value || right.isLoading.value" class="text-ink-400">Loading runs…</p>
    <p v-else-if="left.error.value || right.error.value" role="alert" class="text-bad">
      {{ (left.error.value ?? right.error.value)?.message }}
    </p>
    <RunCompare
      v-else-if="left.data.value && right.data.value"
      :left="left.data.value"
      :right="right.data.value"
      :left-timeline="leftTimeline"
      :right-timeline="rightTimeline"
    />
  </div>
</template>
