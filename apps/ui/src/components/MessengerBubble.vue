<script setup lang="ts">
/** ChatGPT-dark-inspired messenger row: user gets a bubble (right), assistant is bubble-less (left). */

import MarkdownIt from 'markdown-it';
import type { HistoryEntry } from '../lib/types';

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

const REACT_PRESETS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];

const props = defineProps<{
  entry: HistoryEntry; daemonUrl: string; token: string;
  reactions?: Map<string, number>;
  transcript?: string;
  replyPreview?: string;
  /** Optimistic-send marker — bubble renders at 50% opacity until the SSE echo arrives. */
  pending?: boolean;
  /** True when the composer'​s replyingTo points at this bubble — show a warm-gold ring. */
  replyTarget?: boolean;
}>();
const emit = defineEmits<{ (e: 'react', emoji: string): void; (e: 'reply'): void }>();
const pickerOpen = ref(false);

const MESSENGER_USER = 'metro://messenger/user/owner';
const mine = computed(() => props.entry.from === MESSENGER_USER);
const attachments = computed<Attachment[]>(() => {
  const p = props.entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p!.attachments : [];
});

const lightboxUrl = ref<string | null>(null);

const md = new MarkdownIt({ linkify: true, breaks: true, html: false });
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  t.attrSet('target', '_blank');
  t.attrSet('rel', 'noopener');
  return defaultLinkOpen(tokens, idx, opts, env, self);
};
const html = computed(() => props.entry.text ? md.render(props.entry.text) : '');
const hasAudioAttachment = computed(() => attachments.value.some(a => a.kind === 'audio'));
const transcribingFresh = computed(() => Date.now() - new Date(props.entry.ts).getTime() < 30_000);

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
  <div class="flex flex-col" :class="mine ? 'items-end' : 'items-start'">
    <div
      class="text-[17px] leading-[23px] flex flex-col gap-1.5 select-text break-words relative transition-opacity"
      :class="[
        mine
          ? 'max-w-[78%] px-3.5 py-2 rounded-2xl rounded-br-md bg-metro-fg-light dark:bg-[#cbd5e1] text-white dark:text-black'
          : 'w-full px-0 py-0 text-metro-fg-light dark:text-metro-fg-dark',
        pending ? 'opacity-50' : '',
        replyTarget ? 'ring-2 ring-[#c0a06e] ring-offset-2 ring-offset-metro-bg-light dark:ring-offset-metro-bg-dark' : '',
      ]"
    >
      <div v-if="props.replyPreview"
        class="border-l-2 border-current opacity-60 pl-2 text-[12px] italic truncate"
      >{{ props.replyPreview }}</div>
      <template v-for="att in attachments" :key="att.id">
        <img
          v-if="att.kind === 'image'"
          :src="fullUrl(att)"
          class="max-w-full max-h-[280px] rounded-lg object-cover cursor-zoom-in"
          loading="lazy"
          @click="lightboxUrl = fullUrl(att)"
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
      <div v-if="html" class="messenger-md" v-html="html"></div>
      <div v-if="props.transcript" class="text-[13px] italic opacity-75">“{{ props.transcript }}”</div>
      <div v-else-if="hasAudioAttachment && transcribingFresh"
        class="text-[12px] italic opacity-60">transcribing…</div>
      <!-- Bottom row: react + reply icons + timestamp. Mirrors the mobile bubble's
           always-visible action row, replacing the hover-shown floating buttons. -->
      <div
        class="flex items-center gap-1.5"
        :class="mine ? 'justify-end' : 'justify-start'"
      >
        <button type="button" title="React"
          class="opacity-60 hover:opacity-100 transition"
          :class="mine ? 'text-current' : 'text-metro-sub-light dark:text-metro-sub-dark'"
          @click.stop="pickerOpen = !pickerOpen">
          <HeroIcon name="faceSmile" :size="14" />
        </button>
        <button type="button" title="Reply"
          class="opacity-60 hover:opacity-100 transition"
          :class="mine ? 'text-current' : 'text-metro-sub-light dark:text-metro-sub-dark'"
          @click.stop="emit('reply')">
          <HeroIcon name="reply" :size="14" />
        </button>
        <span class="text-[10px]"
          :class="mine ? 'opacity-60' : 'text-metro-sub-light dark:text-metro-sub-dark'"
        >{{ fmtTs(entry.ts) }}</span>
      </div>
    </div>
    <div v-if="reactions && reactions.size" class="flex flex-wrap gap-1 mt-1 max-w-[78%]">
      <span
        v-for="[emoji, count] in [...reactions.entries()]"
        :key="emoji"
        class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px]
          bg-metro-hover-light dark:bg-metro-hover-dark text-metro-fg-light dark:text-metro-fg-dark"
      >
        <span>{{ emoji }}</span>
        <span class="text-metro-sub-light dark:text-metro-sub-dark text-[11px]">{{ count }}</span>
      </span>
    </div>
    <div v-if="pickerOpen" class="flex gap-2 mt-1 px-2 py-1 rounded-full shadow
      bg-metro-surface-light dark:bg-metro-surface-dark border border-metro-border-light dark:border-metro-border-dark">
      <button
        v-for="e in REACT_PRESETS"
        :key="e"
        type="button"
        class="text-lg hover:scale-125 transition-transform"
        @click="emit('react', e); pickerOpen = false"
      >{{ e }}</button>
      <button type="button" class="text-metro-sub-light dark:text-metro-sub-dark text-sm px-1"
        @click="pickerOpen = false">✕</button>
    </div>
    <Teleport to="body">
      <div
        v-if="lightboxUrl"
        class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-zoom-out"
        @click="lightboxUrl = null"
      >
        <img :src="lightboxUrl" class="max-w-[95vw] max-h-[95vh] object-contain" @click.stop />
        <button
          type="button"
          class="absolute top-4 right-4 text-white text-2xl w-10 h-10 rounded-full bg-black/40 flex items-center justify-center"
          @click="lightboxUrl = null"
        >✕</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.messenger-md :deep(p) { margin: 0; }
.messenger-md :deep(p + p),
.messenger-md :deep(p + ul),
.messenger-md :deep(p + ol),
.messenger-md :deep(p + pre),
.messenger-md :deep(p + h1),
.messenger-md :deep(p + h2),
.messenger-md :deep(p + h3) { margin-top: 0.4em; }
.messenger-md :deep(h1) { font-size: 1.25em; font-weight: 700; }
.messenger-md :deep(h2) { font-size: 1.15em; font-weight: 700; }
.messenger-md :deep(h3) { font-size: 1.05em; font-weight: 700; }
.messenger-md :deep(a) { text-decoration: underline; color: currentColor; }
.messenger-md :deep(code) { background: rgba(127,127,127,0.15); padding: 0 4px; border-radius: 3px; font-family: Menlo, ui-monospace, monospace; font-size: 0.95em; }
.messenger-md :deep(pre) { background: rgba(127,127,127,0.15); padding: 8px; border-radius: 6px; overflow-x: auto; }
.messenger-md :deep(pre code) { background: transparent; padding: 0; }
.messenger-md :deep(ul) { padding-left: 1.4em; list-style: disc; }
.messenger-md :deep(ol) { padding-left: 1.4em; list-style: decimal; }
.messenger-md :deep(blockquote) { border-left: 3px solid rgba(127,127,127,0.3); padding-left: 0.6em; opacity: 0.85; }
</style>
