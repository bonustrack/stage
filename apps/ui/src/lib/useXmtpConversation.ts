
import {
  ref, computed, watch, watchEffect,
  type ComputedRef, type Ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  XMTP_USER_PREFIX, convOfLine, lineOfConv, peerEthAddressOfDm, memberInboxToAddressMap,
} from './xmtp';
import { useXmtpFeed, reactionsByMessage, ownEmojisByMessage, isReactionEntry, type XmtpFeedHandle } from './xmtpFeed';
import { votesByMessage, ownVotesByMessage } from '@stage-labs/client/xmtp/poll-feed';
import { xmtpVote } from './xmtpSend';
import { useBubbleActions } from './useBubbleActions';
import { markConvRead } from './channelsCache';
import { postUnreadToParent } from './embedBridge';
import type { HistoryEntry } from '@stage-labs/client/types';
import { readProfile, loadCachedProfile } from './profile';
import { shortAddress } from '@stage-labs/client/identity/format';
import type { MentionCandidate } from '@stage-labs/client/xmtp/mentions';

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
  mentionCandidates: ComputedRef<MentionCandidate[]>;
  reactions: ComputedRef<Map<string, Map<string, number>>>;
  ownEmojis: ComputedRef<Map<string, Set<string>>>;
  pollVotes: ComputedRef<Map<string, Map<number, Map<number, Set<string>>>>>;
  ownPollVotes: ComputedRef<Map<string, Map<number, Set<number>>>>;
  onVote: (pollId: string, questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  allBubbles: ComputedRef<HistoryEntry[]>;
  highlightId: Ref<string | null>;
  scrollStickToBottom: ComputedRef<boolean>;
  scrollToNonce: Ref<number>;
  scrollToId: ComputedRef<string | undefined>;
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

function useMentionCandidates(
  memberAddresses: ComputedRef<string[]>,
  isGroup: ComputedRef<boolean>,
): { mentionCandidates: ComputedRef<MentionCandidate[]> } {
  const memberNames = ref<Record<string, string>>({});
  const remember = (addr: string, name: string | undefined): void => {
    if (name) memberNames.value = { ...memberNames.value, [addr.toLowerCase()]: name };
  };
  watch(memberAddresses, (addrs) => {
    for (const addr of addrs) {
      if (memberNames.value[addr.toLowerCase()]) continue;
      remember(addr, loadCachedProfile(addr)?.name);
      void readProfile(addr).then(p => { remember(addr, p?.name); });
    }
  }, { immediate: true });
  const mentionCandidates = computed<MentionCandidate[]>(() =>
    isGroup.value
      ? memberAddresses.value.map(addr => ({
          address: addr,
          name: memberNames.value[addr.toLowerCase()] ?? shortAddress(addr),
        }))
      : [],
  );
  return { mentionCandidates };
}

interface ConvMeta { peerAddress: string | null; groupName: string; inboxToAddr: Record<string, string> }

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

function isOptimisticTwin(live: HistoryEntry, optimisticEntry: HistoryEntry, myUri: string): boolean {
  return live.from === myUri && live.text === optimisticEntry.text
    && Math.abs(new Date(live.ts).getTime() - new Date(optimisticEntry.ts).getTime()) < 30_000;
}

function pendingOptimistic(
  optimisticEntries: HistoryEntry[], live: HistoryEntry[], myUri: string,
): HistoryEntry[] {
  return optimisticEntries.filter(o => !live.some(e => isOptimisticTwin(e, o, myUri)));
}

interface PollPayload { poll?: { multiSelect?: boolean; questions?: { multiSelect?: boolean }[] } }

function isMultiSelect(events: HistoryEntry[], pollMessageId: string, questionIndex: number): boolean {
  const poll = (events.find(e => e.id === pollMessageId)?.payload as PollPayload | undefined)?.poll;
  return (poll?.questions?.[questionIndex]?.multiSelect ?? poll?.multiSelect) === true;
}

interface CastVoteArgs {
  line: string | null;
  events: HistoryEntry[];
  ownVotes: Map<string, Map<number, Set<number>>>;
  pollMessageId: string;
  questionIndex: number;
  optionIndex: number;
  action: 'added' | 'removed';
}

function castVote(a: CastVoteArgs): void {
  if (!a.line) return;
  if (a.action === 'added' && !isMultiSelect(a.events, a.pollMessageId, a.questionIndex)) {
    const prev = a.ownVotes.get(a.pollMessageId)?.get(a.questionIndex);
    for (const prevIdx of prev ?? []) {
      if (prevIdx !== a.optionIndex) {
        void xmtpVote(a.line, a.pollMessageId, prevIdx, 'removed', a.questionIndex).catch(() => undefined);
      }
    }
  }
  void xmtpVote(a.line, a.pollMessageId, a.optionIndex, a.action, a.questionIndex).catch(() => undefined);
}

interface PollVotesHandle {
  pollVotes: ComputedRef<Map<string, Map<number, Map<number, Set<string>>>>>;
  ownPollVotes: ComputedRef<Map<string, Map<number, Set<number>>>>;
  onVote: (pollMessageId: string, questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
}

function usePollVotes(
  feed: XmtpFeedHandle, myUri: ComputedRef<string>, line: ComputedRef<string | null>,
): PollVotesHandle {
  const pollVotes = computed(() => votesByMessage(feed.events.value));
  const ownPollVotes = computed(() => ownVotesByMessage(feed.events.value, myUri.value));
  const onVote = (
    pollMessageId: string, questionIndex: number, optionIndex: number, action: 'added' | 'removed',
  ): void => {
    castVote({
      line: line.value, events: feed.events.value, ownVotes: ownPollVotes.value,
      pollMessageId, questionIndex, optionIndex, action,
    });
  };
  return { pollVotes, ownPollVotes, onVote };
}

export function useXmtpConversation(): XmtpConversation {
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

  const peerAddress = ref<string | null>(null);
  const groupName = ref<string>('');
  const isGroup = computed(() => peerAddress.value === null && groupName.value !== '');
  const inboxToAddr = ref<Record<string, string>>({});
  const memberAddresses = computed(() => Object.entries(inboxToAddr.value)
    .filter(([id]) => id !== feed.inboxId.value).map(([, addr]) => addr));
  const { mentionCandidates } = useMentionCandidates(memberAddresses, isGroup);

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
  const ownEmojis = computed(() => ownEmojisByMessage(feed.events.value, myUri.value));
  const { pollVotes, ownPollVotes, onVote } = usePollVotes(feed, myUri, line);

  const liveBubbles = computed(() => feed.events.value.filter(e => !isReactionEntry(e)));

  const allBubbles = computed(() => {
    const live = pendingOptimistic(optimistic.value, liveBubbles.value, myUri.value);
    return [...liveBubbles.value, ...live].reverse();
  });

  watch([liveBubbles, optimistic], () => {
    if (!optimistic.value.length) return;
    const stillPending = pendingOptimistic(optimistic.value, liveBubbles.value, myUri.value);
    if (stillPending.length !== optimistic.value.length) optimistic.value = stillPending;
  });

  const targetMsgId = computed(() => {
    const m = route.query.m;
    return (Array.isArray(m) ? m[0] : m) ?? null;
  });
  const highlightId = ref<string | null>(null);
  const scrollToNonce = ref(0);
  const scrollToId = computed(() => targetMsgId.value ? `msg-${targetMsgId.value}` : undefined);
  const scrollStickToBottom = computed(() => true);

  watch([convId, targetMsgId], () => {
    const id = targetMsgId.value;
    if (!id) return;
    scrollToNonce.value += 1;
    highlightId.value = id;
    window.setTimeout(() => { if (highlightId.value === id) highlightId.value = null; }, 2200);
  }, { immediate: true });

  const {
    previewOf, onReact, onOptimistic, onSent, onActionReply,
    onBubbleReply, onActionCopy, onActionCopyLink,
  } = useBubbleActions({ convId, line, myUri, actionTarget, replyingTo, optimistic });

  return {
    router, convId, line, feed, myUri, replyingTo, actionTarget,
    peerAddress, groupName, isGroup, inboxToAddr, memberAddresses, mentionCandidates,
    reactions, ownEmojis, pollVotes, ownPollVotes, onVote,
    allBubbles, highlightId, scrollStickToBottom, scrollToNonce, scrollToId, openHeader, previewOf,
    onReact, onOptimistic, onSent, onActionReply, onBubbleReply,
    onActionCopy, onActionCopyLink,
  };
}
