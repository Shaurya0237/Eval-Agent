<script setup lang="ts">
/** Page: tasks & configs (the YAML definitions). */
import PageHeader from '../../components/ui/PageHeader.vue';
import DefinitionsOverview from './components/DefinitionsOverview.vue';
import { useDefinitions } from './composables/useDefinitions';

const definitions = useDefinitions();
</script>

<template>
  <div>
    <PageHeader
      title="Tasks & configs"
      description="What gets tested: the agent configs being compared, and the questions each one answers."
    />
    <p v-if="definitions.isLoading.value" class="text-ink-400">Loading definitions…</p>
    <p v-else-if="definitions.error.value" role="alert" class="text-bad">{{ definitions.error.value.message }}</p>
    <DefinitionsOverview v-else-if="definitions.data.value" :definitions="definitions.data.value" />
  </div>
</template>
