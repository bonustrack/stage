<script setup lang="ts">
/** XMTP conversation view — live-streamed via the local XMTP client. */

import { XMTP_USER_PREFIX, convOfLine, lineOfConv, peerEthAddressOfDm, memberInboxToAddressMap } from '../lib/xmtp';
import { xmtpReact } from '../lib/xmtpSend';
import { useXmtpFeed, reactionsByMessage, isReactionEntry } from '../lib/xmtpFeed';
import { markConvRead } from '../lib/channelsCache';
import { postUnreadToParent } from '../lib/embedBridge';
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

/** Header metadata — DM peer address or group name. */
const peerAddress = ref<string | null>(null);
const groupName = ref<string>('');
const isGroup = computed(() => peerAddress.value === null && groupName.value !== '');
/** inboxId → eth address for every member (threaded into each bubble). */
const inboxToAddr = ref<Record<string, string>>({});
/** Member eth addresses excluding self — drives the header avatar stack. */
const memberAddresses = computed(() =>
  Object.entries(inboxToAddr.value)
    .filter(([id]) => id !== feed.inboxId.value)
    .map(([, addr]) => addr),
);

watchEffect(async () => {
  if (!convId.value || !line.value) return;
  peerAddress.value = null;
  groupName.value = '';
  inboxToAddr.value = {};
  const conv = await convOfLine(line.value).catch(() => null);
  if (!conv) return;
  const peer = await peerEthAddressOfDm(conv);
  if (peer) peerAddress.value = peer;
  else {
    const n = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
    groupName.value = typeof n === 'function' ? await n() : (n ?? '');
  }
  inboxToAddr.value = await memberInboxToAddressMap(conv);
});

/** Mark conv as read when bubbles arrive; ping the embed host (if iframed)
 *  with the inbound count so its launcher can badge unread. */
watch(() => feed.events.value.length, (len, prev) => {
  if (convId.value && len > 0) markConvRead(convId.value);
  const added = len - (prev ?? 0);
  if (added > 0) {
    postUnreadToParent(feed.events.value.slice(0, added)
      .filter(e => e.from !== myUri.value && !isReactionEntry(e)).length);
  }
});

function openHeader(): void {
  if (peerAddress.value) void router.push(`/user/${peerAddress.value}`);
  else if (convId.value) void router.push(`/group/${convId.value}`);
}

const reactions = computed(() => reactionsByMessage(feed.events.value));
const liveBubbles = computed(() => feed.events.value.filter(e => !isReactionEntry(e)));

/** Drop optimistic twins of confirmed bubbles; flip to oldest-first. */
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
    pending: true,
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
  } as HistoryEntry];
}

/** Send resolved: flip the optimistic bubble from pending (gray) to normal.
 *  It stays until the live stream echo arrives, at which point the dedup in
 *  allBubbles drops it — so there's no flicker/gap. */
function onSent(localId: string): void {
  optimistic.value = optimistic.value.map(o => (o.id === localId ? { ...o, pending: false } : o));
}

function onActionReply(): void {
  if (actionTarget.value) replyingTo.value = { id: actionTarget.value.id, preview: previewOf(actionTarget.value) };
  actionTarget.value = null;
}

/** Direct reply from the bubble's hover toolbar (no action sheet needed). */
function onBubbleReply(entry: HistoryEntry): void {
  replyingTo.value = { id: entry.id, preview: previewOf(entry) };
}

function onActionCopy(): void {
  const t = actionTarget.value?.text;
  if (t && navigator.clipboard) void navigator.clipboard.writeText(t);
  actionTarget.value = null;
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-metro-bg-light dark:bg-metro-bg-dark">
    <ConversationHeader
      :peer-address="peerAddress"
      :group-name="groupName"
      :is-group="isGroup"
      :member-addresses="memberAddresses"
      :status="feed.status.value"
      @back="router.push('/channels')"
      @open="openHeader"
    />

    <!-- Gradient fades (no hard border) under the topnav + above the composer, like mobile. -->
    <div class="relative flex-1 min-h-0">
      <div class="pointer-events-none absolute top-0 inset-x-0 h-6 z-10 bg-gradient-to-b from-metro-bg-light dark:from-metro-bg-dark to-transparent" />
      <div class="pointer-events-none absolute bottom-0 inset-x-0 h-6 z-10 bg-gradient-to-t from-metro-bg-light dark:from-metro-bg-dark to-transparent" />
      <div ref="scroller" class="absolute inset-0 overflow-y-auto py-3 no-scrollbar">
      <div v-if="allBubbles.length === 0 && feed.status.value === 'loading'"
        class="h-full flex items-center justify-center text-metro-head-light dark:text-metro-head-dark">
        <Spinner :size="28" />
      </div>
      <div v-else-if="allBubbles.length === 0 && feed.status.value === 'open'"
        class="p-8 text-center text-sm text-metro-sub-light dark:text-metro-sub-dark">
        Type a message below to start chatting.
      </div>
      <MessengerBubble
        v-for="entry in allBubbles"
        :key="entry.id"
        :entry="entry"
        :mine="entry.from === myUri"
        :inbox-to-addr="inboxToAddr"
        :reactions="reactions.get(entry.id)"
        :reply-preview="entry.replyTo
          ? previewOf(feed.events.value.find(e => e.id === entry.replyTo) ?? entry)
          : undefined"
        @request-actions="actionTarget = $event"
        @react="onReact($event.entry.id, $event.emoji)"
        @reply="onBubbleReply($event)"
        @open-avatar="router.push(`/user/${$event}`)"
      />
      </div>
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
