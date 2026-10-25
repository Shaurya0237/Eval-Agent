<script setup lang="ts">
/** Hermes install + API key status (text + icon, not colour alone). */
import { useQuery } from '@tanstack/vue-query';
import { api } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import AppIcon from '../ui/AppIcon.vue';

const health = useQuery({ queryKey: queryKeys.health, queryFn: api.health, refetchInterval: 30_000 });
</script>

<template>
  <dl v-if="health.data.value" class="space-y-1.5 text-xs">
    <div class="flex items-center gap-2">
      <AppIcon
        :name="health.data.value.hermesInstalled ? 'check' : 'alert'"
        :size="14"
        :class="health.data.value.hermesInstalled ? 'text-good' : 'text-warn'"
      />
      <dt class="text-ink-500">Hermes</dt>
      <dd class="ml-auto font-mono text-ink-300">{{ health.data.value.hermesVersion ?? 'not installed' }}</dd>
    </div>
    <div class="flex items-center gap-2">
      <AppIcon
        :name="health.data.value.apiKeyConfigured ? 'check' : 'alert'"
        :size="14"
        :class="health.data.value.apiKeyConfigured ? 'text-good' : 'text-warn'"
      />
      <dt class="text-ink-500">OpenAI key</dt>
      <dd class="ml-auto font-mono text-ink-300">{{ health.data.value.apiKeyConfigured ? 'set' : 'missing' }}</dd>
    </div>
  </dl>
</template>
