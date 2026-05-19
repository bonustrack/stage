<script setup lang="ts">
/** ChatGPT-dark-inspired bubble with inline attachment rendering. */
import type { HistoryEntry } from '../lib/types';

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

const props = defineProps<{ entry: HistoryEntry; daemonUrl: string; token: string }>();

const MESSENGER_USER = 'metro://messenger/user/owner';
const mine = computed(() => props.entry.from === MESSENGER_USER);
const attachments = computed<Attachment[]>(() => {
  const p = props.entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p!.attachments : [];
});

function fullUrl(att: Attachment): string {
  return `${props.daemonUrl.replace(/\/$/, '')}${att.url}?token=${encodeURIComponent(props.token)}`;
}

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="flex" :class="mine ? 'justify-end' : 'justify-start'">
    <div
      class="max-w-[78%] px-3.5 py-2 leading-snug text-[15px] rounded-2xl flex flex-col gap-1.5"
      :class="mine
        ? 'bg-metro-fg-light dark:bg-white text-white dark:text-black rounded-br-md'
        : 'bg-metro-hover-light dark:bg-[#2a2d33] text-metro-fg-light dark:text-metro-fg-dark rounded-bl-md'"
    >
      <template v-for="att in attachments" :key="att.id">
        <img
          v-if="att.kind === 'image'"
          :src="fullUrl(att)"
          class="max-w-full max-h-[280px] rounded-lg object-cover"
          loading="lazy"
        />
        <audio
          v-else-if="att.kind === 'audio'"
          :src="fullUrl(att)"
          controls
          class="w-[260px] max-w-full"
        />
        <video
          v-else-if="att.kind === 'video'"
          :src="fullUrl(att)"
          controls
          class="max-w-full max-h-[280px] rounded-lg"
        />
        <a
          v-else
          :href="fullUrl(att)"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md bg-black/10 dark:bg-white/10 text-current no-underline"
        >
          <span>📎</span>
          <span class="flex-1 truncate text-[13px]">{{ att.name ?? att.id }}</span>
          <span class="text-[11px] opacity-60">{{ fmtSize(att.size) }}</span>
        </a>
      </template>
      <div v-if="entry.text">{{ entry.text }}</div>
      <div
        class="text-[10px] opacity-60"
        :class="mine ? 'text-right' : 'text-left'"
      >{{ fmtTs(entry.ts) }}</div>
    </div>
  </div>
</template>
