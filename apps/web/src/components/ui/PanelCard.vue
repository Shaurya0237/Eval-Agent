<script setup lang="ts">
/** Titled section card (heading is linked to the region for screen readers). */
import { useId } from 'vue';

defineProps<{ title: string; subtitle?: string; flush?: boolean }>();
const headingId = useId();
</script>

<template>
  <section class="card" :aria-labelledby="headingId">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-5 py-3.5">
      <div>
        <h2 :id="headingId" class="text-base font-semibold">{{ title }}</h2>
        <p v-if="subtitle" class="text-sm text-ink-500">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </header>
    <div :class="flush ? '' : 'p-5'">
      <slot />
    </div>
  </section>
</template>
