<script setup lang="ts">
import type { HistoryEntry } from '../lib/types';

const route = useRoute();
const entry = computed<HistoryEntry | null>(() => {
  const raw = route.query.data as string | undefined;
  if (!raw) return null;
  try { return JSON.parse(raw) as HistoryEntry; } catch { return null; }
});

const rows = computed<[string, string][]>(() => {
  if (!entry.value) return [];
  const e = entry.value;
  return [
    ['id', e.id], ['ts', e.ts], ['station', e.station],
    ['line', e.line], ['lineName', e.lineName ?? ''],
    ['from', e.from], ['fromName', e.fromName ?? ''],
    ['to', e.to],
    ['messageId', e.messageId ?? ''], ['replyTo', e.replyTo ?? ''],
  ];
});
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <AppHeader />
    <div v-if="!entry" class="p-6 text-metro-sub-light dark:text-metro-sub-dark">Event data unavailable.</div>
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto">
      <section v-if="entry.text">
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mb-1">text</div>
        <div class="text-sm whitespace-pre-wrap">{{ entry.text }}</div>
      </section>
      <section v-for="[k, v] in rows.filter(([, val]) => val)" :key="k">
        <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">{{ k }}</div>
        <div class="font-mono text-xs select-text break-all">{{ v }}</div>
      </section>
      <section v-if="entry.display">
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mb-1">display</div>
        <pre class="bg-metro-surface-light dark:bg-metro-surface-dark p-3 rounded text-xs font-mono whitespace-pre-wrap">{{ entry.display }}</pre>
      </section>
      <section v-if="entry.payload">
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mb-1">payload</div>
        <pre class="bg-metro-surface-light dark:bg-metro-surface-dark p-3 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto">{{ JSON.stringify(entry.payload, null, 2) }}</pre>
      </section>
      <section>
        <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark mb-1">raw</div>
        <pre class="bg-metro-surface-light dark:bg-metro-surface-dark p-3 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto">{{ JSON.stringify(entry, null, 2) }}</pre>
      </section>
    </div>
  </div>
</template>
