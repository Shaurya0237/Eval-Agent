<script setup lang="ts">
/** Page: start a new run. */
import PageHeader from '../../components/ui/PageHeader.vue';
import NewRunForm from './components/NewRunForm.vue';
import { useNewRun } from './composables/useNewRun';

const { definitions, form, formError, estimate, launch, apiKeyConfigured } = useNewRun();
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader
      title="New run"
      description="Runs every task × config × trial, scores each run, and compares each config with the baseline."
      :breadcrumbs="[{ label: 'Overview', to: '/' }, { label: 'New run' }]"
    />
    <NewRunForm
      :definitions="definitions.data.value"
      :form="form"
      :form-error="formError"
      :estimate="estimate.data.value"
      :api-key-configured="apiKeyConfigured"
      :launching="launch.isPending.value"
      :launch-error="launch.error.value?.message ?? null"
      @update="(f) => (form = f)"
      @launch="launch.mutate()"
    />
  </div>
</template>
