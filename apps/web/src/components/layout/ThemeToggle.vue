<script setup lang="ts">
/** Switches light / dark mode. */
import { useTheme } from '../../composables/useTheme';
import AppIcon from '../ui/AppIcon.vue';

const { theme, toggleTheme } = useTheme();
</script>

<template>
  <button
    type="button"
    class="btn w-full justify-start"
    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="16" />
    {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
  </button>
</template>
