<script setup lang="ts">

import { computed } from 'vue';
import ChatKitRenderer from '@stage-labs/kit/vue/chatkit-renderer';
import { useKitPalette } from '@stage-labs/kit/vue/theme-context';
import type { WidgetActionRegistry } from '@stage-labs/kit/chatkit';
import { reactionsRow, type ReactionPill, REACTION_PRESS } from '@stage-labs/views';
import { basicRoot } from '@/lib/chatkitRow';
import { stampAvatarUrl, XMTP_USER_PREFIX } from '../lib/xmtp';
import type { HistoryEntry } from '../lib/types';
import { mapCoordsOf, youtubeIdOf } from '../lib/embedDetect';
import { renderMarkdown } from '../lib/renderMarkdown';
import { parseMentions } from '@stage-labs/client/xmtp/mentions';
import { shortAddress } from '@stage-labs/client/identity/format';
import { readProfile, loadCachedProfile } from '../lib/profile';
import type { PollContent } from '@stage-labs/client/xmtp/poll';

interface AttachmentLike {
  kind: string; mime?: string; name?: string; dataB64?: string; url?: string;
}

const props = defineProps<{
  entry: HistoryEntry;
  mine: boolean;
  reactions?: Map<string, number>;
  ownEmojis?: Set<string>;
  replyTarget?: boolean;
  replyPreview?: string;
  inboxToAddr?: Record<string, string>;
  pollVotes?: Map<number, Map<number, Set<string>>>;
  ownPollVotes?: Map<number, Set<number>>;
}>();
const emit = defineEmits<{
  (e: 'request-actions' | 'reply', entry: HistoryEntry): void;
  (e: 'react', payload: { entry: HistoryEntry; emoji: string }): void;
  (e: 'open-avatar', address: string): void;
  (e: 'vote', payload: { entry: HistoryEntry; questionIndex: number; optionIndex: number; action: 'added' | 'removed' }): void;
}>();

const attachments = computed<AttachmentLike[]>(() => {
  const p = props.entry.payload as { attachments?: AttachmentLike[] } | undefined;
  return Array.isArray(p?.attachments) ? p.attachments : [];
});

const poll = computed<PollContent | null>(() => {
  const p = props.entry.payload as { contentType?: string; poll?: PollContent } | undefined;
  return p?.contentType === 'poll' && p.poll ? p.poll : null;
});

const router = useRouter();

const bodySegments = computed(() => parseMentions(props.entry.text ?? ''));
const hasMentions = computed(() => bodySegments.value.some(s => s.type === 'mention'));

const mentionNames = ref<Record<string, string>>({});
function mentionLabel(address: string): string {
  return mentionNames.value[address.toLowerCase()] ?? shortAddress(address);
}
watchEffect(() => {
  for (const seg of bodySegments.value) {
    if (seg.type !== 'mention') continue;
    const lower = seg.address.toLowerCase();
    if (mentionNames.value[lower]) continue;
    const cached = loadCachedProfile(seg.address)?.name;
    if (cached) mentionNames.value = { ...mentionNames.value, [lower]: cached };
    void readProfile(seg.address).then((p) => {
      if (p?.name) mentionNames.value = { ...mentionNames.value, [lower]: p.name };
    });
  }
});
function openMention(address: string): void {
  void router.push(`/user/${address}`);
}

const hasAudio = computed(() => attachments.value.some(a => a.kind === 'audio'));
const showBodyText = computed(() => !hasAudio.value);

const youtubeId = computed(() => youtubeIdOf(props.entry.text));
const mapCoords = computed(() => mapCoordsOf(props.entry.text));
const isSystem = computed(() => (props.entry.payload as { system?: boolean } | undefined)?.system === true);
const isPending = computed(() => props.entry.pending === true);

const REACT_PRESETS = ['👍', '❤️', '😂', '😮', '🔥', '🎉'];
const pickerOpen = ref(false);

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

const reactionPills = computed<ReactionPill[]>(() =>
  props.reactions
    ? Array.from(props.reactions.entries()).map(([emoji, count]) => ({
        emoji,
        count,
        own: props.ownEmojis?.has(emoji) ?? false,
      }))
    : [],
);

const palette = useKitPalette();

const reactionsNode = computed(() =>
  basicRoot(
    reactionsRow({
      reactions: reactionPills.value,
      dispatchPress: true,
      pillBackground: palette.border,
      ownBorderColor: palette.link,
    }),
  ),
);

const reactionsRegistry: WidgetActionRegistry = {
  [REACTION_PRESS]: (action) => {
    const emoji = action.payload.emoji;
    if (typeof emoji === 'string') emit('react', { entry: props.entry, emoji });
  },
};
</script>

<template>
  <!-- Reply-target / unread row tint mirrors mobile's rowBackground(). -->
  <Row class="group relative flex items-start gap-2.5 px-3 py-1.5 transition-opacity"
    :class="{
      'opacity-50': isPending,
      'bg-black/5 dark:bg-white/[0.09]': props.replyTarget,
    }"
    @contextmenu="onContext"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="clearLongPress"
    @pointercancel="clearLongPress"
    @pointerleave="clearLongPress">
    <!-- 24px stamp.fyi avatar at the start of every row — neutral
         placeholder when the inbox→address mapping hasn't resolved yet
         so geometry doesn't shift. -->
    <Pressable
      tag="button"
      v-if="senderAddress"
      type="button"
      class="shrink-0 mt-0.5"
      @click="onAvatar"
    >
      <img
        :src="stampAvatarUrl(senderAddress, 48)"
        alt=""
        class="w-6 h-6 rounded-full bg-metro-border-dark"
      />
    </Pressable>
    <Col v-else class="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-metro-border-dark" />
    <Col class="flex-1 min-w-0">
      <!-- Timestamp sits at the TOP of the bubble column, mirroring mobile. -->
      <Text size="3xs" color="secondary" class="mb-0.5">{{ isPending ? 'Sending' : fmtTs(props.entry.ts) }}</Text>
      <!-- Mobile draws the 1.5px border only on UNREAD bubbles (borderWidth:
           unread ? 1.5 : 0). Web has no per-message unread signal yet, so read
           messages — the common case — render WITHOUT the box. -->
      <Col>
      <Col v-if="props.replyPreview"
        class="text-[11px] mb-1 opacity-70 border-l-2 border-current pl-1.5 italic font-sans"
        :class="isSystem ? 'text-metro-sub-light dark:text-metro-sub-dark' : 'text-metro-fg-light dark:text-metro-fg-dark'">
        {{ props.replyPreview.slice(0, 80) }}
      </Col>
      <Col v-for="(att, i) in attachments" :key="i" class="mb-1.5">
        <MediaCard v-if="att.kind === 'image' && urlOf(att)">
          <img :src="urlOf(att) ?? undefined" :alt="att.name ?? 'image'" class="block w-full aspect-square object-cover" />
        </MediaCard>
        <VoiceMessage v-else-if="att.kind === 'audio' && urlOf(att)" :src="urlOf(att) ?? ''" />
        <a v-else-if="urlOf(att)"
          :href="urlOf(att) ?? undefined"
          :download="att.name ?? undefined"
          class="inline-flex items-center gap-2 underline text-sm font-sans">
          <Icon name="paperClip" :size="14" />
          <span>{{ att.name ?? `${att.kind} attachment` }}</span>
        </a>
        <span v-else class="text-xs opacity-70 font-sans">[{{ att.kind }}{{ att.name ? `: ${att.name}` : '' }}]</span>
      </Col>
      <!-- Poll card: question, options with tally bars + percentages + counts,
           tap-to-vote, voted state. Reuses the shared poll codec/tally. The poll's
           fallback text is suppressed in favor of the rendered card. -->
      <PollCard v-if="poll"
        :poll="poll"
        :votes="props.pollVotes"
        :own-votes="props.ownPollVotes"
        @vote="emit('vote', { entry: props.entry, ...$event })"
      />
      <!-- Markdown-rendered (linkify + breaks) to match the mobile app: bare URLs
           become clickable links. v-html is safe — markdown-it escapes raw HTML
           and blocks javascript:/data: links. When the body carries @0x mentions
           the text is split into segments (shared parseMentions); each non-mention
           run keeps full markdown, and each mention renders as a tappable link. -->
      <Col v-else-if="props.entry.text && showBodyText && !hasMentions"
        class="break-words font-sans text-[19px] leading-[23px] select-text
          [&_p]:m-0 [&_p:not(:last-child)]:mb-1.5 [&_a]:underline [&_a]:break-words
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_code]:font-mono [&_code]:text-[15px] [&_pre]:whitespace-pre-wrap"
        :class="isSystem
          ? 'text-metro-fg-light dark:text-metro-fg-dark'
          : 'text-metro-link-light dark:text-metro-link-dark'"
        v-html="renderMarkdown(props.entry.text)"
      />
      <!-- Mention body: segments flow INLINE as one paragraph (mirrors mobile's
           MentionBody single Text run). Body text uses fg; each mention is an
           inline semibold link in the explicit link color (#2f6feb / #7aa2ff),
           distinct from the body fg. -->
      <!-- kit-exception: a normal block (not a kit Col, which forces
           display:flex/column and would stack each segment vertically). Inline
           flow is required so the mention link + surrounding text read as one
           paragraph, matching mobile's MentionBody single Text run. -->
      <component :is="'div'" v-else-if="props.entry.text && showBodyText"
        class="block break-words font-sans text-[19px] leading-[23px] select-text
          [&_p]:m-0 [&_p]:inline [&_a]:underline [&_a]:break-words
          [&_code]:font-mono [&_code]:text-[15px] [&_pre]:whitespace-pre-wrap
          text-metro-link-light dark:text-metro-link-dark">
        <template v-for="(seg, i) in bodySegments" :key="i">
          <Pressable
            v-if="seg.type === 'mention'"
            tag="span"
            role="link"
            class="inline font-semibold text-[#2f6feb] dark:text-[#7aa2ff] hover:underline"
            @click="openMention(seg.address)"
          >@{{ mentionLabel(seg.address) }}</Pressable>
          <span v-else class="inline" v-html="renderMarkdown(seg.text)" />
        </template>
      </component>
      <Col v-if="youtubeId" class="mt-1.5">
        <YouTubeEmbed :video-id="youtubeId" />
      </Col>
      <Col v-else-if="mapCoords" class="mt-1.5">
        <LocationEmbed :lat="mapCoords.lat" :lng="mapCoords.lng" :source-url="mapCoords.sourceUrl" />
      </Col>
      </Col>
      <!-- Action affordances: react + reply icons revealed on hover (web replaces
           mobile's long-press gesture). The timestamp lives at the top of the column. -->
      <Row v-if="!isPending"
        class="flex items-center gap-1.5 mt-1 text-metro-sub-light dark:text-metro-sub-dark
          opacity-0 group-hover:opacity-100 transition-opacity">
        <Pressable tag="button" type="button" title="React"
          class="hover:opacity-70" @click="pickerOpen = !pickerOpen">
          <Icon name="faceSmile" :size="14" />
        </Pressable>
        <Pressable tag="button" type="button" title="Reply"
          class="hover:opacity-70" @click="emit('reply', props.entry)">
          <Icon name="reply" :size="14" />
        </Pressable>
      </Row>
      <!-- Inline emoji picker — toggled by the react icon, mirrors mobile. -->
      <!-- Shadowed (no-border) rounded sheet with large emoji — mirrors mobile's
           ReactionPicker (size="5xl" emoji, shadow not border). -->
      <Row v-if="pickerOpen"
        class="inline-flex items-center gap-2 mt-1.5 px-2.5 py-1.5 rounded-full
          bg-metro-surface-light dark:bg-metro-surface-dark shadow-lg">
        <Pressable tag="button" v-for="e in REACT_PRESETS" :key="e" type="button"
          class="text-4xl leading-none hover:scale-125 transition-transform"
          @click="emit('react', { entry: props.entry, emoji: e }); pickerOpen = false">{{ e }}</Pressable>
        <Pressable tag="button" type="button" class="px-1 text-metro-sub-light dark:text-metro-sub-dark"
          @click="pickerOpen = false">✕</Pressable>
      </Row>
      <!-- Reactions pills on their own row below (matches mobile), rendered from
           ChatKit JSON via the shared reactionsRow builder. -->
      <Col v-if="reactionPills.length > 0" class="mt-1">
        <ChatKitRenderer :node="reactionsNode" :registry="reactionsRegistry" />
      </Col>
    </Col>
  </Row>
</template>
