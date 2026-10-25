<script setup lang="ts">
/** Root: app shell around the routed page. */
import AppShell from './components/layout/AppShell.vue';
</script>

<template>
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 120ms ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
