<script setup lang="ts">
/** Discord-style messenger row: every message left-aligned, 24px stamp
 *  avatar at the start, no colored bubble even for the local user's own
 *  messages. Mirrors apps/app/components/MessengerBubble.tsx so the two
 *  clients look identical. */

import { stampBoxAvatarUrl, XMTP_USER_PREFIX } from '../lib/xmtp';
import type { HistoryEntry } from '../lib/types';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';

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
  (e: 'open-avatar', address: string): void;
}>();

const attachments = computed<AttachmentLike[]>(() => {
  const p = props.entry.payload as { attachments?: AttachmentLike[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
});

const youtubeId = computed(() => youtubeIdOf(props.entry.text));
const mapCoords = computed(() => mapCoordsOf(props.entry.text));
const isSystem = computed(() => (props.entry.payload as { system?: boolean } | undefined)?.system === true);

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

function onAvatar(): void {
  if (senderAddress.value) emit('open-avatar', senderAddress.value);
}
</script>

<template>
  <div class="flex items-start gap-2.5 px-3 py-1.5" @contextmenu="onContext">
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
      <div v-if="props.entry.text"
        class="whitespace-pre-wrap break-words font-sans text-[16px] leading-snug select-text"
        :class="isSystem
          ? 'text-metro-sub-light dark:text-metro-sub-dark'
          : 'text-metro-head-light dark:text-metro-head-dark'">
        {{ props.entry.text }}
      </div>
      <div v-if="youtubeId" class="mt-1.5">
        <YouTubeEmbed :video-id="youtubeId" />
      </div>
      <div v-else-if="mapCoords" class="mt-1.5">
        <LocationEmbed :lat="mapCoords.lat" :lng="mapCoords.lng" :source-url="mapCoords.sourceUrl" />
      </div>
      <div class="flex items-center gap-1.5 mt-1 text-[10px] text-metro-sub-light dark:text-metro-sub-dark font-sans">
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
