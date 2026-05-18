<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import StationIcon from './StationIcon.vue';
import type { HistoryEntry } from '../lib/types';

const props = defineProps<{ entry: HistoryEntry }>();
const router = useRouter();
const MAX_BODY = 140;

const body = computed(() => {
  const e = props.entry;
  if (e.text) return e.text;
  if (e.emoji) return `[react ${e.emoji}]`;
  return '(no text)';
});
const text = computed(() => {
  const b = body.value;
  return b.length > MAX_BODY ? b.slice(0, MAX_BODY - 1) + '…' : b;
});
const sender = computed(() =>
  (props.entry.fromName ?? props.entry.from).replace(/^metro:\/\//, ''),
);
const lineLabel = computed(() =>
  props.entry.lineName ?? props.entry.line.replace(/^metro:\/\//, ''),
);
const ts = computed(() => {
  try { return new Date(props.entry.ts).toLocaleTimeString([], { hour12: false }); }
  catch { return props.entry.ts.slice(11, 19); }
});
const kindColor = computed(() => props.entry.kind === 'inbound'
  ? 'text-metro-accent'
  : props.entry.kind === 'outbound'
    ? 'text-metro-ok'
    : 'text-metro-warn',
);

function open(): void {
  void router.push({
    name: 'event',
    params: { id: props.entry.id },
    query: { data: JSON.stringify(props.entry) },
  });
}
</script>

<template>
  <button
    type="button"
    class="w-full text-left px-4 py-3 border-b border-metro-border-light dark:border-metro-border-dark
      bg-metro-surface-light dark:bg-metro-surface-dark hover:bg-metro-hover-light dark:hover:bg-metro-hover-dark
      transition-colors"
    @click="open"
  >
    <div class="flex items-center gap-2 mb-1">
      <StationIcon :station="entry.station" />
      <span class="text-[11px] font-semibold uppercase" :class="kindColor">{{ entry.kind }}</span>
      <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate flex-1">{{ sender }}</span>
      <span class="text-xs text-metro-sub-light dark:text-metro-sub-dark">{{ ts }}</span>
    </div>
    <div class="text-xs text-metro-sub-light dark:text-metro-sub-dark truncate">{{ lineLabel }}</div>
    <div class="text-sm text-metro-fg-light dark:text-metro-fg-dark whitespace-pre-wrap line-clamp-3">{{ text }}</div>
  </button>
</template>
