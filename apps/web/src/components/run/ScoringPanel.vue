<script setup lang="ts">
/** The three scoring layers for one run. */
import type { RunDetail } from '@eval-lab/shared';
import { formatScore, formatSeconds, formatUsd } from '../../utils/format';

defineProps<{ detail: RunDetail }>();
</script>

<template>
  <div class="space-y-3">
    <section v-if="detail.result?.error" class="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
      <h3 class="font-semibold text-warn">Run problem: {{ detail.result.status }}</h3>
      <pre class="mt-1 max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap text-warn/80">{{ detail.result.error }}</pre>
    </section>

    <section class="card p-4">
      <h3 class="flex items-baseline justify-between font-semibold">
        1 · Outcome <span class="text-xs font-normal text-ink-400">decides the score</span>
      </h3>
      <ul v-if="detail.score" class="mt-2 space-y-2 text-sm">
        <li v-for="c in detail.score.outcomeChecks" :key="c.id" class="rounded-lg bg-ink-800 p-2.5">
          <div class="flex items-center gap-2">
            <span :class="c.passed ? 'text-good' : c.score > 0 ? 'text-warn' : 'text-bad'">{{
              c.passed ? '✓' : c.score > 0 ? '◐' : '✗'
            }}</span>
            <code class="font-mono text-xs">{{ c.id }}</code>
            <span class="ml-auto font-mono text-xs text-ink-400">{{ formatScore(c.score) }}</span>
          </div>
          <p class="mt-1 text-xs text-ink-300">{{ c.explanation }}</p>
        </li>
      </ul>
      <p v-else class="mt-2 text-sm text-ink-400">Not scored yet.</p>
    </section>

    <section v-if="detail.score" class="card p-4">
      <h3 class="font-semibold">2 · Efficiency</h3>
      <dl class="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt class="label-xs">Cost</dt>
          <dd class="font-mono">
            {{ formatUsd(detail.score.metrics.costUsd) }} <span class="text-[10px] text-ink-400">{{ detail.result?.costSource }}</span>
          </dd>
        </div>
        <div>
          <dt class="label-xs">Time</dt>
          <dd class="font-mono">{{ formatSeconds(detail.score.metrics.durationMs) }}</dd>
        </div>
        <div>
          <dt class="label-xs">Model calls</dt>
          <dd class="font-mono">{{ detail.score.metrics.apiCalls }} / {{ detail.config.maxTurns }}</dd>
        </div>
        <div>
          <dt class="label-xs">Tokens in / out</dt>
          <dd class="font-mono">
            {{ detail.score.metrics.inputTokens.toLocaleString() }} / {{ detail.score.metrics.outputTokens.toLocaleString() }}
          </dd>
        </div>
      </dl>
    </section>

    <section v-if="detail.score" class="card p-4">
      <h3 class="flex items-baseline justify-between font-semibold">
        3 · Process <span class="text-xs font-normal text-ink-400">diagnosis only</span>
      </h3>
      <ul class="mt-2 space-y-1.5 text-sm">
        <li v-for="f in detail.score.processFlags" :key="f.id" class="flex gap-2">
          <span :class="f.ok ? 'text-good' : 'text-warn'">{{ f.ok ? '✓' : '⚠' }}</span>
          <span
            ><code class="font-mono text-xs text-ink-200">{{ f.id }}</code> <span class="text-ink-400">{{ f.explanation }}</span></span
          >
        </li>
      </ul>
    </section>
  </div>
</template>
