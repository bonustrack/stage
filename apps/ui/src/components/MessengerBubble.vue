<script setup lang="ts">
/** Discord-style messenger row: every message left-aligned, 24px stamp
 *  avatar at the start, no colored bubble even for the local user's own
 *  messages. Mirrors apps/app/components/MessengerBubble.tsx so the two
 *  clients look identical. */

import { stampBoxAvatarUrl, XMTP_USER_PREFIX } from '../lib/xmtp';
import type { HistoryEntry } from '../lib/types';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
import { renderMarkdown } from '../lib/renderMarkdown';

interface AttachmentLike {
  kind: string; mime?: string; name?: string; dataB64?: string; url?: string;
}

const props = defineProps<{
  entry: HistoryEntry;
  mine: boolean;
  reactions?: Map<string, number>;
  replyPreview?: string;
  /** inboxId → eth address map, threaded from the parent so the avatar
   *  can be resolved for each sender without a per-bubble round trip. */
  inboxToAddr?: Record<string, string>;
}>();
const emit = defineEmits<{
  (e: 'request-actions', entry: HistoryEntry): void;
  (e: 'react', payload: { entry: HistoryEntry; emoji: string }): void;
  (e: 'reply', entry: HistoryEntry): void;
  (e: 'open-avatar', address: string): void;
}>();

const attachments = computed<AttachmentLike[]>(() => {
  const p = props.entry.payload as { attachments?: AttachmentLike[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
});

const youtubeId = computed(() => youtubeIdOf(props.entry.text));
const mapCoords = computed(() => mapCoordsOf(props.entry.text));
const isSystem = computed(() => (props.entry.payload as { system?: boolean } | undefined)?.system === true);
/** Optimistic message awaiting network confirmation — render gray, like mobile. */
const isPending = computed(() => props.entry.pending === true);

const QUICK_EMOJIS = ['👍', '❤️', '😂'];

const senderInboxId = computed(() => {
  const f = props.entry.from ?? '';
  return f.startsWith(XMTP_USER_PREFIX) ? f.slice(XMTP_USER_PREFIX.length) : '';
});
const senderAddress = computed(() => {
  const id = senderInboxId.value;
  return id && props.inboxToAddr ? props.inboxToAddr[id] ?? null : null;
});

function fmtTs(ts: string): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return ts.slice(11, 16); }
}

function urlOf(att: AttachmentLike): string | null {
  if (att.url) return att.url;
  if (att.dataB64 && att.mime) return `data:${att.mime};base64,${att.dataB64}`;
  return null;
}

function onContext(ev: MouseEvent): void {
  ev.preventDefault();
  emit('request-actions', props.entry);
}

/** Long-press (touch) / press-hold (mouse) opens the action sheet, matching the
 *  mobile app — right-click alone isn't reachable on touch and gets swallowed
 *  by the host page inside the embed widget. Cancels if the pointer moves
 *  (a scroll/drag) or lifts before the hold threshold. */
let lpTimer: ReturnType<typeof setTimeout> | null = null;
let lpX = 0;
let lpY = 0;
function clearLongPress(): void {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
}
function onPointerDown(ev: PointerEvent): void {
  lpX = ev.clientX; lpY = ev.clientY;
  clearLongPress();
  lpTimer = setTimeout(() => { lpTimer = null; emit('request-actions', props.entry); }, 450);
}
function onPointerMove(ev: PointerEvent): void {
  if (!lpTimer) return;
  if (Math.abs(ev.clientX - lpX) > 10 || Math.abs(ev.clientY - lpY) > 10) clearLongPress();
}

function onAvatar(): void {
  if (senderAddress.value) emit('open-avatar', senderAddress.value);
}
</script>

<template>
  <div class="group relative flex items-start gap-2.5 px-4 py-1.5 transition-opacity"
    :class="{ 'opacity-50': isPending }"
    @contextmenu="onContext"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="clearLongPress"
    @pointercancel="clearLongPress"
    @pointerleave="clearLongPress">
    <!-- Hover toolbar (desktop): quick reactions + reply, so react/reply are
         discoverable without needing the long-press / right-click sheet. -->
    <div v-if="!isPending"
      class="absolute -top-2 right-3 z-10 flex items-center gap-0.5 px-1 py-0.5 rounded-full
        opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity
        bg-metro-surface-light dark:bg-metro-surface-dark
        border border-metro-border-light dark:border-metro-border-dark shadow-sm">
      <button v-for="e in QUICK_EMOJIS" :key="e" type="button"
        class="px-1 text-base leading-none hover:scale-125 transition-transform"
        @click="emit('react', { entry: props.entry, emoji: e })">{{ e }}</button>
      <button type="button" title="Reply"
        class="px-1 text-metro-fg-light dark:text-metro-fg-dark hover:opacity-70"
        @click="emit('reply', props.entry)">
        <HeroIcon name="reply" :size="15" />
      </button>
    </div>
    <!-- 24px stamp.fyi avatar at the start of every row — neutral
         placeholder when the inbox→address mapping hasn't resolved yet
         so geometry doesn't shift. -->
    <button
      v-if="senderAddress"
      type="button"
      class="shrink-0 mt-0.5"
      @click="onAvatar"
    >
      <img
        :src="stampBoxAvatarUrl(senderAddress, 48)"
        alt=""
        class="w-6 h-6 rounded-full bg-metro-border-dark"
      />
    </button>
    <div v-else class="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-metro-border-dark" />
    <div class="flex-1 min-w-0">
      <div v-if="props.replyPreview"
        class="text-[11px] mb-1 opacity-70 border-l-2 border-current pl-1.5 italic font-sans"
        :class="isSystem ? 'text-metro-sub-light dark:text-metro-sub-dark' : 'text-metro-fg-light dark:text-metro-fg-dark'">
        {{ props.replyPreview.slice(0, 80) }}
      </div>
      <div v-for="(att, i) in attachments" :key="i" class="mb-1.5">
        <MediaCard v-if="att.kind === 'image' && urlOf(att)">
          <img :src="urlOf(att) ?? undefined" :alt="att.name ?? 'image'" class="block w-full aspect-square object-cover" />
        </MediaCard>
        <a v-else-if="urlOf(att)"
          :href="urlOf(att) ?? undefined"
          :download="att.name ?? undefined"
          class="inline-flex items-center gap-2 underline text-sm font-sans">
          <HeroIcon name="paperClip" :size="14" />
          <span>{{ att.name ?? `${att.kind} attachment` }}</span>
        </a>
        <span v-else class="text-xs opacity-70 font-sans">[{{ att.kind }}{{ att.name ? `: ${att.name}` : '' }}]</span>
      </div>
      <!-- Markdown-rendered (linkify + breaks) to match the mobile app: bare URLs
           become clickable links. v-html is safe — markdown-it escapes raw HTML
           and blocks javascript:/data: links. -->
      <div v-if="props.entry.text"
        class="break-words font-sans text-[17px] leading-snug select-text
          [&_p]:m-0 [&_p:not(:last-child)]:mb-1.5 [&_a]:underline [&_a]:break-words
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_code]:font-mono [&_code]:text-[15px] [&_pre]:whitespace-pre-wrap"
        :class="isSystem
          ? 'text-metro-fg-light dark:text-metro-fg-dark'
          : 'text-metro-head-light dark:text-metro-head-dark'"
        v-html="renderMarkdown(props.entry.text)"
      />
      <div v-if="youtubeId" class="mt-1.5">
        <YouTubeEmbed :video-id="youtubeId" />
      </div>
      <div v-else-if="mapCoords" class="mt-1.5">
        <LocationEmbed :lat="mapCoords.lat" :lng="mapCoords.lng" :source-url="mapCoords.sourceUrl" />
      </div>
      <div class="flex items-center gap-1.5 mt-1 text-[11px] text-metro-sub-light dark:text-metro-sub-dark font-sans">
        <span>{{ fmtTs(props.entry.ts) }}</span>
        <template v-if="props.reactions && props.reactions.size > 0">
          <button
            v-for="[emoji, count] in props.reactions"
            :key="emoji"
            type="button"
            class="px-1.5 py-0.5 rounded-full bg-metro-surface-light dark:bg-metro-surface-dark
              border border-metro-border-light dark:border-metro-border-dark
              text-[11px] text-metro-fg-light dark:text-metro-fg-dark"
            @click="emit('react', { entry: props.entry, emoji })"
          >{{ emoji }} {{ count }}</button>
        </template>
      </div>
    </div>
  </div>
</template>
