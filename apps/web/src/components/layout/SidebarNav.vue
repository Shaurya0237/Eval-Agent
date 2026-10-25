<script setup lang="ts">
/** Primary navigation (icon + label; current page marked with aria-current). */
import { useRoute } from 'vue-router';
import AppIcon, { type IconName } from '../ui/AppIcon.vue';

defineEmits<{ navigate: [] }>();
const route = useRoute();

const ITEMS: { to: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { to: '/', label: 'Overview', icon: 'grid', match: (p) => p === '/' || p.startsWith('/experiments') },
  { to: '/new', label: 'New run', icon: 'plus', match: (p) => p === '/new' },
  { to: '/definitions', label: 'Tasks & configs', icon: 'layers', match: (p) => p.startsWith('/definitions') },
];
</script>

<template>
  <nav aria-label="Main">
    <ul class="space-y-1">
      <li v-for="item in ITEMS" :key="item.to">
        <RouterLink
          :to="item.to"
          class="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          :class="item.match(route.path) ? 'bg-accent-soft text-accent' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'"
          :aria-current="item.match(route.path) ? 'page' : undefined"
          @click="$emit('navigate')"
        >
          <AppIcon :name="item.icon" :size="18" />
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
