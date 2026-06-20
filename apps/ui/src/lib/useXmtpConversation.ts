/** @file Composable backing the XMTP conversation view (feed wiring, header metadata, optimistic bubbles, permalink scroll, bubble actions), extracted from XmtpConversation.vue so the SFC stays under the lint cap. */

import {
  ref, computed, watch, watchEffect, nextTick, onMounted,
  type ComputedRef, type Ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  XMTP_USER_PREFIX, convOfLine, lineOfConv, peerEthAddressOfDm, memberInboxToAddressMap,
} from './xmtp';
import { useXmtpFeed, reactionsByMessage, isReactionEntry, type XmtpFeedHandle } from './xmtpFeed';
import { useBubbleActions } from './useBubbleActions';
import { markConvRead } from './channelsCache';
import { postUnreadToParent } from './embedBridge';
import type { HistoryEntry } from './types';

export interface XmtpConversation {
  router: ReturnType<typeof useRouter>;
  convId: ComputedRef<string>;
  line: ComputedRef<string | null>;
  feed: XmtpFeedHandle;
  myUri: ComputedRef<string>;
  replyingTo: Ref<{ id: string; preview: string } | null>;
  actionTarget: Ref<HistoryEntry | null>;
  peerAddress: Ref<string | null>;
  groupName: Ref<string>;
  isGroup: ComputedRef<boolean>;
  inboxToAddr: Ref<Record<string, string>>;
  memberAddresses: ComputedRef<string[]>;
  reactions: ComputedRef<Map<string, Map<string, number>>>;
  allBubbles: ComputedRef<HistoryEntry[]>;
  highlightId: Ref<string | null>;
  openHeader: () => void;
  previewOf: (e: HistoryEntry) => string;
  onReact: (messageId: string, emoji: string) => void;
  onOptimistic: (payload: { localId: string; text: string; replyTo?: string }) => void;
  onSent: (localId: string) => void;
  onActionReply: () => void;
  onBubbleReply: (entry: HistoryEntry) => void;
  onActionCopy: () => void;
  onActionCopyLink: () => void;
}

/** Header metadata (peer address or group name) resolved for a conversation. */
interface ConvMeta { peerAddress: string | null; groupName: string; inboxToAddr: Record<string, string> }

/** Load a conversation's header metadata: DM peer address or group name, plus the inbox→address map. */
async function loadConvMeta(line: string): Promise<ConvMeta> {
  const empty: ConvMeta = { peerAddress: null, groupName: '', inboxToAddr: {} };
  const conv = await convOfLine(line).catch(() => null);
  if (!conv) return empty;
  const peer = await peerEthAddressOfDm(conv);
  let groupName = '';
  let peerAddress: string | null = null;
  if (peer) peerAddress = peer;
  else {
    const n = (conv as unknown as { name?: string | (() => Promise<string>) }).name;
    groupName = typeof n === 'function' ? await n() : (n ?? '');
  }
  return { peerAddress, groupName, inboxToAddr: await memberInboxToAddressMap(conv) };
}

/** True when a live confirmed bubble is the network twin of an optimistic one (same author/text within 30s). */
function isOptimisticTwin(live: HistoryEntry, optimisticEntry: HistoryEntry, myUri: string): boolean {
  return live.from === myUri && live.text === optimisticEntry.text
    && Math.abs(new Date(live.ts).getTime() - new Date(optimisticEntry.ts).getTime()) < 30_000;
}

/** Drop optimistic entries that already have a confirmed live twin. */
function pendingOptimistic(
  optimisticEntries: HistoryEntry[], live: HistoryEntry[], myUri: string,
): HistoryEntry[] {
  return optimisticEntries.filter(o => !live.some(e => isOptimisticTwin(e, o, myUri)));
}

/** Scroll the given scroller element to its bottom. */
function scrollToBottom(scroller: Ref<HTMLElement | null>): void {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
}

/** Hook providing XMTP conversation-view state: feed, header metadata, optimistic bubbles, and bubble actions. */
export function useXmtpConversation(scroller: Ref<HTMLElement | null>): XmtpConversation {
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

  /** Refresh header metadata into the local refs for the active conversation. */
  async function refreshConvMeta(): Promise<void> {
    if (!convId.value || !line.value) return;
    peerAddress.value = null;
    groupName.value = '';
    inboxToAddr.value = {};
    const meta = await loadConvMeta(line.value);
    peerAddress.value = meta.peerAddress;
    groupName.value = meta.groupName;
    inboxToAddr.value = meta.inboxToAddr;
  }
  watchEffect(() => { void refreshConvMeta(); });

  /** Mark conv as read when bubbles arrive; ping the embed host (if iframed) with the inbound count so its launcher can badge unread. */
  watch(() => feed.events.value.length, (len, prev) => {
    if (convId.value && len > 0) markConvRead(convId.value);
    const added = len - (prev ?? 0);
    if (added > 0) {
      postUnreadToParent(feed.events.value.slice(0, added)
        .filter(e => e.from !== myUri.value && !isReactionEntry(e)).length);
    }
  });

  /** Open Header. */
  function openHeader(): void {
    if (peerAddress.value) void router.push(`/user/${peerAddress.value}`);
    else if (convId.value) void router.push(`/group/${convId.value}`);
  }

  const reactions = computed(() => reactionsByMessage(feed.events.value));
  const liveBubbles = computed(() => feed.events.value.filter(e => !isReactionEntry(e)));

  /** Drop optimistic twins of confirmed bubbles; flip to oldest-first. */
  const allBubbles = computed(() => {
    const live = pendingOptimistic(optimistic.value, liveBubbles.value, myUri.value);
    return [...liveBubbles.value, ...live].reverse();
  });

  watch([liveBubbles, optimistic], () => {
    if (!optimistic.value.length) return;
    const stillPending = pendingOptimistic(optimistic.value, liveBubbles.value, myUri.value);
    if (stillPending.length !== optimistic.value.length) optimistic.value = stillPending;
  });

  /** Permalink target message (`?m=<msgId>`): when set, scroll to and flash-highlight that bubble once it appears instead of pinning to the bottom, cleared after the first scroll so later messages resume sticky-bottom. */
  const targetMsgId = computed(() => {
    const m = route.query.m;
    return (Array.isArray(m) ? m[0] : m) ?? null;
  });
  const highlightId = ref<string | null>(null);
  const scrolledToTarget = ref(false);

  /** Scroll To Target Message. */
  function scrollToTargetMessage(): boolean {
    const id = targetMsgId.value;
    if (!id || scrolledToTarget.value) return false;
    const el = document.getElementById(`msg-${id}`);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    highlightId.value = id;
    scrolledToTarget.value = true;
    /** Drop the highlight after the flash animation so re-renders don't replay it. */
    window.setTimeout(() => { if (highlightId.value === id) highlightId.value = null; }, 2200);
    return true;
  }

  /** Reset the one-shot scroll guard when navigating to a different permalink. */
  watch([convId, targetMsgId], () => { scrolledToTarget.value = false; });

  watch(allBubbles, () => {
    void nextTick(() => {
      /** If a permalink targets a message not yet reached, try to scroll there; only fall back to the bottom when there's no target. */
      if (targetMsgId.value && !scrolledToTarget.value) {
        if (scrollToTargetMessage()) return;
        /** Target not in the feed yet — stay put while more history streams in. */
        return;
      }
      scrollToBottom(scroller);
    });
  }, { flush: 'post' });
  onMounted(() => {
    void nextTick(() => {
      if (targetMsgId.value && scrollToTargetMessage()) return;
      scrollToBottom(scroller);
    });
  });

  const {
    previewOf, onReact, onOptimistic, onSent, onActionReply,
    onBubbleReply, onActionCopy, onActionCopyLink,
  } = useBubbleActions({ convId, line, myUri, actionTarget, replyingTo, optimistic });

  return {
    router, convId, line, feed, myUri, replyingTo, actionTarget,
    peerAddress, groupName, isGroup, inboxToAddr, memberAddresses,
    reactions, allBubbles, highlightId, openHeader, previewOf,
    onReact, onOptimistic, onSent, onActionReply, onBubbleReply,
    onActionCopy, onActionCopyLink,
  };
}
