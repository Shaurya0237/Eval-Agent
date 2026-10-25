<script setup lang="ts">
/** Page title block: optional breadcrumbs, h1, description, and an actions slot. */
defineProps<{ title: string; description?: string; breadcrumbs?: { label: string; to?: string }[] }>();
</script>

<template>
  <header class="mb-6 space-y-3">
    <nav v-if="breadcrumbs?.length" aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-1.5 text-sm text-ink-500">
        <li v-for="(b, i) in breadcrumbs" :key="i" class="flex items-center gap-1.5">
          <RouterLink v-if="b.to" :to="b.to" class="hover:text-accent hover:underline">{{ b.label }}</RouterLink>
          <span v-else aria-current="page" class="text-ink-300">{{ b.label }}</span>
          <span v-if="i < breadcrumbs.length - 1" aria-hidden="true">/</span>
        </li>
      </ol>
    </nav>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
          <slot name="badges" />
        </div>
        <p v-if="description" class="mt-1 max-w-3xl text-ink-400">{{ description }}</p>
        <slot name="meta" />
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
