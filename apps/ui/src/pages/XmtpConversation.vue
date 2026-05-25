<script setup lang="ts">
/** XMTP conversation view — opened from /channels or /contacts. Live-streams via the
 *  local XMTP client. Layout: top-nav with back arrow, scrollable message list (newest
 *  at the bottom), composer pinned to the viewport bottom. */

import { XMTP_USER_PREFIX, lineOfConv } from '../lib/xmtp';
import { xmtpReact } from '../lib/xmtpSend';
import { useXmtpFeed, reactionsByMessage, isReactionEntry } from '../lib/xmtpFeed';
import type { HistoryEntry } from '../lib/types';

const route = useRoute();
const router = useRouter();
const convId = computed(() => (route.params.convId as string | undefined) ?? '');
const line = computed(() => convId.value ? lineOfConv(convId.value) : null);
const enabled = computed(() => !!convId.value);

const feed = useXmtpFeed(line, enabled);
const myUri = computed(() => feed.inboxId.value ? `${XMTP_USER_PREFIX}${feed.inboxId.value}` : XMTP_USER_PREFIX);

const replyingTo = ref<{ id: string; preview: string } | null>(null);
const actionTarget = ref<HistoryEntry | null>(null);
const optimistic = ref<HistoryEntry[]>([]);

const reactions = computed(() => reactionsByMessage(feed.events.value));
const liveBubbles = computed(() => feed.events.value.filter(e => !isReactionEntry(e)));

/** Filter optimistic entries inline so the streamed-confirmed bubble never renders
 *  alongside its pending twin. liveBubbles is newest-first; flip to oldest-first
 *  for top-down rendering. */
const allBubbles = computed(() => {
  const live = optimistic.value.filter(o =>
    !liveBubbles.value.some(e => e.from === myUri.value && e.text === o.text
      && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
  );
  return [...liveBubbles.value, ...live].reverse();
});

watch([liveBubbles, optimistic], () => {
  if (!optimistic.value.length) return;
  const stillPending = optimistic.value.filter(o =>
    !liveBubbles.value.some(e => e.from === myUri.value && e.text === o.text
      && Math.abs(new Date(e.ts).getTime() - new Date(o.ts).getTime()) < 30_000),
  );
  if (stillPending.length !== optimistic.value.length) optimistic.value = stillPending;
});

const scroller = ref<HTMLElement | null>(null);

function previewOf(e: HistoryEntry): string {
  if (e.text) return e.text.slice(0, 80);
  const att = (e.payload as { attachments?: { kind: string }[] } | undefined)?.attachments?.[0]?.kind;
  return `[${att ?? 'attachment'}]`;
}

watch(allBubbles, () => {
  nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight; });
}, { flush: 'post' });
onMounted(() => {
  nextTick(() => { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight; });
});

function onReact(messageId: string, emoji: string): void {
  if (!line.value) return;
  void xmtpReact(line.value, messageId, emoji).catch(() => undefined);
  actionTarget.value = null;
}

function onOptimistic(payload: { localId: string; text: string; replyTo?: string }): void {
  optimistic.value = [...optimistic.value, {
    id: payload.localId,
    ts: new Date().toISOString(),
    station: 'xmtp',
    line: line.value ?? '',
    from: myUri.value,
    to: line.value ?? '',
    text: payload.text,
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
  } as HistoryEntry];
}

function onSent(localId: string): void {
  optimistic.value = optimistic.value.filter(o => o.id !== localId);
}

function onActionReply(): void {
  if (actionTarget.value) replyingTo.value = { id: actionTarget.value.id, preview: previewOf(actionTarget.value) };
  actionTarget.value = null;
}

function onActionCopy(): void {
  const t = actionTarget.value?.text;
  if (t && navigator.clipboard) void navigator.clipboard.writeText(t);
  actionTarget.value = null;
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-metro-bg-light dark:bg-metro-bg-dark">
    <div class="h-12 flex items-center px-3 border-b border-metro-border-light dark:border-metro-border-dark
      bg-metro-bg-light dark:bg-metro-bg-dark shrink-0 relative">
      <button type="button" class="p-1.5 text-metro-fg-light dark:text-metro-fg-dark"
        @click="router.push('/channels')">
        <HeroIcon name="arrowLeft" :size="22" />
      </button>
      <div v-if="feed.status.value !== 'open'"
        class="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5
          px-2.5 py-1 rounded-full bg-metro-hover-light dark:bg-metro-hover-dark">
        <span class="w-1.5 h-1.5 rounded-full"
          :class="feed.status.value === 'loading' ? 'bg-metro-warn'
            : feed.status.value === 'error' ? 'bg-metro-err' : 'bg-metro-sub-dark'" />
        <span class="text-[11px] text-metro-sub-light dark:text-metro-sub-dark">
          {{ feed.status.value === 'loading' ? 'Connecting…'
             : feed.status.value === 'error' ? 'Reconnecting…' : 'Offline' }}
        </span>
      </div>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto py-3 no-scrollbar">
      <div v-if="allBubbles.length === 0 && feed.status.value === 'open'"
        class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
      <MessengerBubble
        v-for="entry in allBubbles"
        :key="entry.id"
        :entry="entry"
        :mine="entry.from === myUri"
        :reactions="reactions.get(entry.id)"
        :reply-preview="entry.replyTo
          ? previewOf(feed.events.value.find(e => e.id === entry.replyTo) ?? entry)
          : undefined"
        @request-actions="actionTarget = $event"
        @react="onReact($event.entry.id, $event.emoji)"
      />
    </div>

    <Composer
      v-if="line"
      :line="line"
      :replying-to="replyingTo"
      @clear-reply="replyingTo = null"
      @optimistic="onOptimistic"
      @sent="onSent"
    />

    <BubbleActionSheet
      :target="actionTarget"
      @close="actionTarget = null"
      @react="onReact(actionTarget!.id, $event)"
      @reply="onActionReply"
      @copy="onActionCopy"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }
</style>
