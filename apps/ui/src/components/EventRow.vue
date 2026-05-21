<script setup lang="ts">
import type { HistoryEntry } from '../lib/types';

const props = defineProps<{ entry: HistoryEntry }>();
const router = useRouter();
const MAX_BODY = 140;

const text = computed(() => {
  const b = props.entry.text ?? '(no text)';
  return b.length > MAX_BODY ? b.slice(0, MAX_BODY - 1) + '…' : b;
});
const sender = computed(() => (props.entry.fromName ?? props.entry.from).replace(/^metro:\/\//, ''));
const lineLabel = computed(() => props.entry.lineName ?? props.entry.line.replace(/^metro:\/\//, ''));
const ts = computed(() => {
  try { return new Date(props.entry.ts).toLocaleTimeString([], { hour12: false }); }
  catch { return props.entry.ts.slice(11, 19); }
});

function open(): void {
  void router.push({
    name: 'event', params: { id: props.entry.id },
    query: { data: JSON.stringify(props.entry) },
  });
}
</script>

<template>
  <button
    type="button"
    class="w-full text-left px-3 py-1.5 hover:opacity-80 transition-opacity flex items-start gap-2.5"
    @click="open"
  >
    <div class="pt-1"><StationIcon :station="entry.station" /></div>
    <div class="flex-1 min-w-0 flex flex-col gap-0.5">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[13px] font-semibold text-metro-fg-light dark:text-metro-fg-dark truncate">{{ sender }}</span>
        <span class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">{{ ts }}</span>
      </div>
      <div class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark truncate">{{ lineLabel }}</div>
      <!-- Messenger-style bubble for the body. -->
      <div class="mt-1 px-3 py-2 rounded-2xl rounded-tl-sm bg-metro-surface-light dark:bg-metro-surface-dark">
        <div class="text-[15px] leading-snug text-metro-fg-light dark:text-metro-fg-dark whitespace-pre-wrap line-clamp-4">{{ text }}</div>
      </div>
    </div>
  </button>
</template>
