<script setup lang="ts">
/** Page frame: skip link, sidebar (desktop) or drawer (mobile), and the main landmark. */
import { onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '../ui/AppIcon.vue';
import EnvironmentStatus from './EnvironmentStatus.vue';
import SidebarNav from './SidebarNav.vue';
import ThemeToggle from './ThemeToggle.vue';

const drawerOpen = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => (drawerOpen.value = false),
);

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') drawerOpen.value = false;
}
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <a href="#main" class="skip-link">Skip to content</a>

  <div class="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
    <!-- Mobile top bar -->
    <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-700 bg-ink-900 px-4 lg:hidden">
      <button
        type="button"
        class="btn min-h-10 min-w-10 px-2"
        aria-controls="app-sidebar"
        :aria-expanded="drawerOpen"
        aria-label="Open navigation"
        @click="drawerOpen = true"
      >
        <AppIcon name="menu" :size="18" />
      </button>
      <RouterLink to="/" class="flex items-center gap-2 font-semibold"
        ><AppIcon name="flask" :size="18" class="text-accent" /> Agent Eval Lab</RouterLink
      >
    </header>

    <!-- Drawer backdrop (mobile) -->
    <Transition name="fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-hidden="true" @click="drawerOpen = false" />
    </Transition>

    <!-- Sidebar: static on desktop, slide-in drawer on mobile -->
    <aside
      id="app-sidebar"
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-ink-700 bg-ink-900 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:translate-x-0"
      :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'"
      aria-label="Sidebar"
    >
      <div class="flex h-14 items-center justify-between px-5 lg:h-16">
        <RouterLink to="/" class="flex items-center gap-2 text-base font-semibold">
          <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-on-accent"
            ><AppIcon name="flask" :size="16"
          /></span>
          Agent Eval Lab
        </RouterLink>
        <button type="button" class="btn min-h-9 min-w-9 px-2 lg:hidden" aria-label="Close navigation" @click="drawerOpen = false">
          <AppIcon name="close" :size="16" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav @navigate="drawerOpen = false" />
      </div>
      <div class="space-y-3 border-t border-ink-700 p-4">
        <EnvironmentStatus />
        <ThemeToggle />
      </div>
    </aside>

    <main id="main" tabindex="-1" class="min-w-0 outline-none">
      <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
