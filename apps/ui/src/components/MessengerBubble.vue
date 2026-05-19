<script setup lang="ts">
/** ChatGPT-dark-inspired messenger row: user gets a bubble (right), assistant is bubble-less (left). */

import MarkdownIt from 'markdown-it';
import type { HistoryEntry } from '../lib/types';

interface Attachment { id: string; url: string; kind: string; mime: string; size: number; name?: string }

const props = defineProps<{ entry: HistoryEntry; daemonUrl: string; token: string }>();

const MESSENGER_USER = 'metro://messenger/user/owner';
const mine = computed(() => props.entry.from === MESSENGER_USER);
const attachments = computed<Attachment[]>(() => {
  const p = props.entry.payload as { attachments?: Attachment[] } | undefined;
  return Array.isArray(p?.attachments) ? p!.attachments : [];
});

const md = new MarkdownIt({ linkify: true, breaks: true, html: false });
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const t = tokens[idx];
  t.attrSet('target', '_blank');
  t.attrSet('rel', 'noopener');
  return defaultLinkOpen(tokens, idx, opts, env, self);
};
const html = computed(() => props.entry.text ? md.render(props.entry.text) : '');

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
      class="leading-snug text-[15px] flex flex-col gap-1.5 select-text break-words"
      :class="mine
        ? 'max-w-[78%] px-3.5 py-2 rounded-2xl rounded-br-md bg-metro-fg-light dark:bg-white text-white dark:text-black'
        : 'w-full px-0 py-0 text-metro-fg-light dark:text-metro-fg-dark'"
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
      <div v-if="html" class="messenger-md" v-html="html"></div>
      <div
        class="text-[10px]"
        :class="mine ? 'text-right opacity-60' : 'text-left text-metro-sub-light dark:text-metro-sub-dark'"
      >{{ fmtTs(entry.ts) }}</div>
    </div>
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
