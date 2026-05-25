<script setup lang="ts">
/** Chat bubble: own messages right-aligned (accent fill), others left-aligned (surface fill).
 *  Renders text, reply pill, attachments, and a reactions strip. Long-press / right-click
 *  fires `request-actions` so the parent can pop the action sheet. */

import type { HistoryEntry } from '../lib/types';

interface AttachmentLike {
  kind: string; mime?: string; name?: string; dataB64?: string; url?: string;
}

const props = defineProps<{
  entry: HistoryEntry;
  mine: boolean;
  reactions?: Map<string, number>;
  replyPreview?: string;
}>();
const emit = defineEmits<{
  (e: 'request-actions', entry: HistoryEntry): void;
  (e: 'react', payload: { entry: HistoryEntry; emoji: string }): void;
}>();

const attachments = computed<AttachmentLike[]>(() => {
  const p = props.entry.payload as { attachments?: AttachmentLike[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
});

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

/** Build a data: URL from a base64-encoded inline attachment so we can render it directly. */
function dataUrlOf(att: AttachmentLike): string | null {
  if (att.url) return att.url;
  if (att.dataB64 && att.mime) return `data:${att.mime};base64,${att.dataB64}`;
  return null;
}

function onContext(ev: MouseEvent): void {
  ev.preventDefault();
  emit('request-actions', props.entry);
}
</script>

<template>
  <div class="flex px-3 my-1.5" :class="props.mine ? 'justify-end' : 'justify-start'">
    <div class="max-w-[78%]" @contextmenu="onContext">
      <div
        class="rounded-2xl px-3.5 py-2 text-[15px] leading-snug select-text"
        :class="props.mine
          ? 'bg-metro-fg-light dark:bg-metro-fg-dark text-metro-bg-light dark:text-metro-bg-dark'
          : 'bg-metro-surface-light dark:bg-metro-surface-dark text-metro-fg-light dark:text-metro-fg-dark'"
      >
        <div v-if="props.replyPreview"
          class="text-[11px] mb-1 px-2 py-1 rounded-md opacity-70 border-l-2 border-current">
          {{ props.replyPreview.slice(0, 80) }}
        </div>
        <div v-for="(att, i) in attachments" :key="i" class="mb-1.5">
          <img v-if="att.kind === 'image' && dataUrlOf(att)"
            :src="dataUrlOf(att) ?? undefined"
            :alt="att.name ?? 'image'"
            class="max-w-full rounded-lg" />
          <a v-else-if="dataUrlOf(att)"
            :href="dataUrlOf(att) ?? undefined"
            :download="att.name ?? undefined"
            class="inline-flex items-center gap-2 underline text-sm">
            <HeroIcon name="paperClip" :size="14" />
            <span>{{ att.name ?? `${att.kind} attachment` }}</span>
          </a>
          <span v-else class="text-xs opacity-70">[{{ att.kind }}{{ att.name ? `: ${att.name}` : '' }}]</span>
        </div>
        <div v-if="props.entry.text" class="whitespace-pre-wrap break-words">{{ props.entry.text }}</div>
      </div>
      <div class="flex items-center gap-1.5 mt-1 text-[10px] text-metro-sub-light dark:text-metro-sub-dark"
        :class="props.mine ? 'justify-end' : 'justify-start'">
        <span>{{ fmtTs(props.entry.ts) }}</span>
        <button
          v-if="props.reactions && props.reactions.size > 0"
          v-for="[emoji, count] in props.reactions"
          :key="emoji"
          type="button"
          class="px-1.5 py-0.5 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark
            border border-metro-border-light dark:border-metro-border-dark
            text-[11px] text-metro-fg-light dark:text-metro-fg-dark"
          @click="emit('react', { entry: props.entry, emoji })"
        >{{ emoji }} {{ count }}</button>
      </div>
    </div>
  </div>
</template>
