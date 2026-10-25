<script setup lang="ts">
/** One trajectory timeline entry; long text collapses. */
import type { TimelineEntry } from './trajectory.logic';
import { preview } from './trajectory.logic';

defineProps<{ item: TimelineEntry; index: number }>();
</script>

<template>
  <li class="relative animate-fade-in pl-8" :style="{ animationDelay: `${Math.min(index, 12) * 35}ms` }">
    <span class="absolute top-0 bottom-0 left-[11px] w-px bg-ink-700" />
    <span
      class="absolute top-3 left-1.5 h-3 w-3 rounded-full border-2 border-ink-950"
      :class="{
        'bg-ink-600': item.kind === 'system',
        'bg-ink-400': item.kind === 'user',
        'bg-sim': item.kind === 'thought',
        'bg-accent': item.kind === 'tool',
        'bg-good': item.kind === 'final',
      }"
    />

    <div class="card mb-2 p-3 text-sm">
      <template v-if="item.kind === 'system'">
        <details>
          <summary class="cursor-pointer text-xs text-ink-400">
            system prompt · {{ item.content.length.toLocaleString() }} chars · shows injected memory &amp; skills index
          </summary>
          <pre class="mt-2 max-h-96 overflow-auto rounded-md bg-ink-800 p-3 font-mono text-xs whitespace-pre-wrap text-ink-300">{{
            item.content
          }}</pre>
        </details>
      </template>

      <template v-else-if="item.kind === 'user'">
        <div class="label-xs text-accent">task prompt</div>
        <p class="mt-1 whitespace-pre-wrap text-ink-200">{{ item.content }}</p>
      </template>

      <template v-else-if="item.kind === 'thought'">
        <div class="label-xs text-sim">agent</div>
        <p v-if="item.content" class="mt-1 whitespace-pre-wrap text-ink-200">{{ item.content }}</p>
        <details v-if="item.reasoning" class="mt-1">
          <summary class="cursor-pointer text-xs text-ink-400">reasoning</summary>
          <p class="mt-1 text-xs whitespace-pre-wrap text-ink-300">{{ item.reasoning }}</p>
        </details>
      </template>

      <template v-else-if="item.kind === 'tool'">
        <div class="flex items-center gap-2">
          <span class="label-xs text-accent">tool call</span>
          <code class="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent">{{ item.call.name }}</code>
        </div>
        <pre
          class="mt-2 overflow-auto rounded-md bg-ink-800 p-2.5 font-mono text-xs whitespace-pre-wrap text-ink-300"
        ><span class="text-ink-600">$ </span>{{ item.argsPretty }}</pre>
        <template v-if="item.result">
          <div class="mt-2 label-xs">result</div>
          <pre
            v-if="!preview(item.result.content).truncated"
            class="mt-1 overflow-auto rounded-md bg-ink-800 p-2.5 font-mono text-xs whitespace-pre-wrap text-ink-200"
            >{{ item.result.content }}</pre>
          <details v-else class="mt-1">
            <summary class="cursor-pointer list-none">
              <pre class="overflow-auto rounded-md bg-ink-800 p-2.5 font-mono text-xs whitespace-pre-wrap text-ink-200">{{
                preview(item.result.content).text
              }}</pre>
              <span class="text-xs text-accent">show all</span>
            </summary>
            <pre class="mt-1 max-h-96 overflow-auto rounded-md bg-ink-800 p-2.5 font-mono text-xs whitespace-pre-wrap text-ink-200">{{
              item.result.content
            }}</pre>
          </details>
        </template>
        <p v-else class="mt-1 text-xs text-warn">No result recorded (the run may have been cut off).</p>
      </template>

      <template v-else>
        <div class="label-xs text-good">final answer</div>
        <p class="mt-1 font-mono whitespace-pre-wrap text-ink-100">{{ item.content }}</p>
      </template>
    </div>
  </li>
</template>
