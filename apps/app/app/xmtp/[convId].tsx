/** XMTP conversation view — opened from the messenger tab list. Talks to the
 *  local XMTP client directly; no daemon hop. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, AppState, Dimensions, Modal, Pressable, ScrollView, Share, View } from 'react-native';
import { Text } from '@metro-labs/kit/text';
/** RNGH's gesture-aware FlatList (drop-in for RN's): its scroll runs through a
 *  native RNGH handler, so under GestureDetectorProvider it COMPOSES with the
 *  native-stack edge swipe-back instead of being starved by it. The edge gesture
 *  is left-edge-confined + horizontal; this scroll is vertical → RNGH arbitrates
 *  them by direction and the scroll wins everywhere off the edge. */
import { FlatList } from 'react-native-gesture-handler';
import { Box } from '../../components/layout';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MessengerBubble, REACT_PRESETS } from '../../components/MessengerBubble';
import { stripMentionMarkup, attachmentEmojiPreview } from '@metro-labs/client/xmtp/humanize';
import { usePeerProfiles, getPeerName, getPeerAvatar } from '../../lib/peerProfiles';
import { useConvMeta } from '../../lib/useConvMeta';
import { Spinner } from '../../components/Spinner';
import { MessengerComposer } from '../../components/MessengerComposer';
import { ComposerGradient } from '../../components/ComposerGradient';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../../components/Avatar';
import { ChannelMenu } from '../../components/ChannelMenu';
import { isPinned } from '../../lib/pins';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReact, xmtpReply, xmtpVote,
  shortAddress, xmtpSendTxReference,
} from '../../lib/xmtp';
import { votesByPoll as tallyVotes, ownVotes as tallyOwnVotes, type VoteEvent } from '@metro-labs/client/xmtp/poll';
import {
  type WalletSendCallsContent, type TransactionReferenceContent, chainIdToNumber,
} from '@metro-labs/client/xmtp/tx';
import { sendNativeOrToken } from '../../lib/tx';
import { flash } from '../../lib/toast';
import { xmtpSendSignatureReference } from '../../lib/xmtp';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
} from '@metro-labs/client/xmtp/sign';
import { signTypedData, signMessage, getAccount } from 'wagmi/actions';
import { wagmiConfig } from '../../lib/walletconnect';
import { getActiveViemAccount } from '../../lib/accounts';
import {
  hasOverlayPermission, isPillAvailable, openConversationAsBubble,
  requestOverlayPermission, showPill,
} from '../../lib/pill';
import { setActiveConversation } from '../../modules/metro-pill';
import { getCachedRows, markConvRead, patchRowSent } from '../../lib/channelsCache';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import type { HistoryEntry } from '../../lib/types';

/** Whether an entry carries attachments — used to dedup an optimistic
 *  attachment-only send (empty text) against its confirmed twin. */
function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

/** True when a reaction is actually a poll VOTE (and so must not render as an
 *  emoji pill). A vote is either tagged `schema:'custom'`, or — for decode paths
 *  that drop the schema — a reaction on a poll bubble whose content is a pure
 *  non-negative integer that is a valid option index for that poll. A genuine
 *  emoji reaction on a poll (❤️, 👍, …) is NOT an integer, so it stays a pill. */
function isPollVote(
  p: { reactTo?: string; emoji?: string; schema?: string } | undefined,
  pollOptionCounts: Map<string, number>,
): boolean {
  if (!p) return false;
  if (p.schema === 'custom') return true;
  if (!p.reactTo || !p.emoji) return false;
  const optionCount = pollOptionCounts.get(p.reactTo);
  if (optionCount === undefined) return false; // not a reaction on a poll
  if (!/^\d+$/.test(p.emoji)) return false; // a real emoji, not a bare index
  const idx = Number.parseInt(p.emoji, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < optionCount;
}

/** Reaction events decorate their target msg — fold them into per-message,
 *  per-emoji counts rather than rendering as standalone bubbles. */
function reactionsByMessage(events: HistoryEntry[], pollOptionCounts: Map<string, number>): Map<string, Map<string, number>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    /** Skip poll VOTES only — they're tallied separately by votesByPoll and would
     *  otherwise render as a "0"/"1"/"2" emoji pill. Genuine emoji reactions on a
     *  poll (❤️, 👍, …) must still render as pills. */
    if (isPollVote(p, pollOptionCounts)) continue;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let m = out.get(msgId);
    if (!m) { m = new Map(); out.set(msgId, m); }
    m.set(emoji, (m.get(emoji) ?? 0) + 1);
  }
  return out;
}

/** Emojis the local user currently has on each message (latest add not undone by a
 *  later removal). Drives un-react: tapping an emoji you already own toggles it off. */
function ownReactionsByMessage(events: HistoryEntry[], myUri: string, pollOptionCounts: Map<string, number>): Map<string, Set<string>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    if (e.from !== myUri) continue;
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (isPollVote(p, pollOptionCounts)) continue;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Set<string>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let s = out.get(msgId);
    if (!s) { s = new Set(); out.set(msgId, s); }
    s.add(emoji);
  }
  return out;
}

function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

/** Adapt the conversation's reaction events into the shared `VoteEvent` shape
 *  the pure tally helpers consume. Only schema:'custom' reactions are votes. */
function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({ reference: p.reactTo, content: p.emoji, schema: 'custom', removed: !!p.removed, voter: e.from, ts: e.ts });
  }
  return out;
}

/** Poll message ids → option count, derived from the poll bubbles in the feed.
 *  Used to tell a vote (content = a valid option index) from a genuine emoji
 *  reaction on a poll, when the vote's `schema:'custom'` tag didn't survive decode. */
function pollOptionCountsInFeed(events: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) {
    const p = e.payload as { contentType?: string; poll?: { options?: unknown[] } } | undefined;
    if (p?.contentType === 'poll' && Array.isArray(p.poll?.options)) out.set(e.id, p.poll.options.length);
  }
  return out;
}

/** Poll message ids → multiSelect flag, derived from the poll bubbles in the feed
 *  (single-select tallies dedupe differently than multi). */
function pollsInFeed(events: HistoryEntry[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const e of events) {
    const p = e.payload as { contentType?: string; poll?: { multiSelect?: boolean } } | undefined;
    if (p?.contentType === 'poll' && p.poll) out.set(e.id, p.poll.multiSelect === true);
  }
  return out;
}

/** Build `pollMessageId → (optionIndex → Set<voterUri>)` for every poll in the feed. */
function votesByMessage(events: HistoryEntry[]): Map<string, Map<number, Set<string>>> {
  const polls = pollsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Set<string>>>();
  for (const [pollId, multi] of polls) out.set(pollId, tallyVotes(voteEvents, pollId, multi));
  return out;
}

/** Option indices the local user has selected, per poll message id. */
function ownVotesByMessage(events: HistoryEntry[], myUri: string): Map<string, Set<number>> {
  const polls = pollsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Set<number>>();
  for (const [pollId, multi] of polls) out.set(pollId, tallyOwnVotes(voteEvents, myUri, pollId, multi));
  return out;
}

/** Topnav avatar — 1-1 conversations use the peer's identicon/custom avatar,
 *  groups show their uploaded image (none → render nothing, no per-member
 *  fallback stacking). Delegates rendering to the shared Avatar component. */
function HeaderAvatar({ peerAddr, groupImage, border }: {
  peerAddr: string | null; groupImage: string; border: string;
}): React.ReactElement | null {
  if (peerAddr) {
    return <Avatar address={peerAddr} imageUri={getPeerAvatar(peerAddr)} size="sm" style={{ backgroundColor: border }} />;
  }
  if (groupImage) {
    return <Avatar imageUri={groupImage} size="sm" square style={{ backgroundColor: border }} />;
  }
  return null;
}

export default function XmtpConversation(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();

  const { convId, focus } = useLocalSearchParams<{ convId: string; focus?: string }>();
  const activeLine = lineOfConv(convId ?? '');
  /** When opened with `?focus=1` (e.g. from the floating pill's "open chat"),
   *  raise the keyboard + focus the composer on arrival. A one-shot nonce taken
   *  at mount drives the composer's autofocus effect. */
  const autoFocusNonce = useMemo(() => (focus ? Date.now() : undefined), [focus]);

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  const { loadOlder, hasMore, loadingOlder } = xmtpFeed;
  /** Mark the conversation as read whenever the latest event id changes —
   *  uses `Date.now() * 1e6` as an upper bound in nanoseconds so any
   *  not-yet-seen message also flips to read on the next mount. */
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId);
  }, [convId, events.length]);
  /** Tell native which conversation is on-screen so the FCM service suppresses a
   *  push for it (the user is already looking at it). Set on focus, cleared on
   *  blur AND when the app backgrounds (so a push for THIS conv still fires once
   *  the user can't see it). `active_conv == convId` ⟺ "foreground + viewing it".
   *  Native no-ops the call off-Android / on pre-module builds. */
  useFocusEffect(useCallback(() => {
    if (!convId) return;
    setActiveConversation(convId);
    const sub = AppState.addEventListener('change', (s) => {
      setActiveConversation(s === 'active' ? convId : null);
    });
    return () => {
      sub.remove();
      setActiveConversation(null);
    };
  }, [convId]));
  const status: 'idle' | 'connecting' | 'open' | 'error' = xmtpFeed.status === 'open' ? 'open'
    : xmtpFeed.status === 'loading' ? 'connecting'
      : xmtpFeed.status === 'error' ? 'error' : 'idle';
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  const [showJump, setShowJump] = useState(false);
  /** Bump to force-remount the FlatList. Used by jump-to-bottom because every variant of
   *  the scroll API (`scrollToOffset`, `scrollToIndex`, `getScrollResponder`,
   *  `getNativeScrollRef`) trips reanimated #3670 "property is not writable" on devices
   *  with Reduce Motion. Remount lands at the inverted list's default offset = bottom. */
  const [listEpoch, setListEpoch] = useState(0);
  /** `nonce` bumps on every reply action (even re-tapping the same message) so the
   *  composer's focus effect re-fires and re-opens the keyboard each time — keying
   *  only on the message id deduped repeat replies after a keyboard dismiss. */
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string; sender?: string | null; nonce: number } | null>(null);
  /** Monotonic reply counter — guarantees a fresh `nonce` on EVERY swipe-to-reply,
   *  even two taps on the same message within the same millisecond (where
   *  `Date.now()` would collide and React would bail on the focus effect, leaving
   *  the keyboard closed on the 2nd+ reply). */
  const replyNonceRef = useRef(0);
  const setReplyTarget = useCallback((id: string, preview: string, sender?: string | null) => {
    replyNonceRef.current += 1;
    setReplyingTo({ id, preview, sender, nonce: replyNonceRef.current });
  }, []);
  /** Transient highlight on a message we jumped to (by tapping its quoted
   *  reply-preview). Distinct from `replyingTo` so jumping to the original
   *  doesn't open the composer reply slab. Cleared after a short flash. */
  const [jumpHighlightId, setJumpHighlightId] = useState<string | null>(null);
  const jumpClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** On-screen rect of the tapped message row — drives where the anchored
   *  Telegram-style menu (emoji strip + action dropdown) floats. */
  const [menuAnchor, setMenuAnchor] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  /** Topnav overflow (3-dot) menu — groups show "Leave group"; DMs show
   *  "Open as bubble" (Android, when the native pill/bubble module is linked). */
  const [overflowOpen, setOverflowOpen] = useState(false);
  /** Whether the native pill/bubble module is present on this build → gates the
   *  DM "Open as bubble" item. Resolved once on mount (cheap native check). */
  const [pillAvailable, setPillAvailable] = useState(false);
  useEffect(() => { setPillAvailable(isPillAvailable()); }, []);
  /** Optimistic outbound entries — rendered immediately on send, dropped once the composer
   *  resolves its send promise (XMTP self-sends don't always come back via streamMessages). */
  const [optimistic, setOptimistic] = useState<HistoryEntry[]>([]);
  /** localId → real XMTP message id, resolved when the composer's send() promise
   *  settles (conv.send returns the id). Lets us confirm/drop an optimistic entry
   *  by EXACT id when that id appears in the live feed — zero false-confirm vs the
   *  text+timestamp heuristic, which stays as a fallback for sends that resolve
   *  without an id (or before the map updates). */
  const [confirmedIds, setConfirmedIds] = useState<Map<string, string>>(new Map());
  /** Optimistic reactions: messageId → emoji[] the local user just tapped, shown
   *  semi-transparent until the live XMTP stream echoes the reaction back (or the
   *  send fails). Dropped per-pair in the dedup effect below + on send rejection. */
  const [optimisticReactions, setOptimisticReactions] = useState<Map<string, string[]>>(new Map());
  /** Optimistic un-reacts: messageId → emoji[] the local user just removed. Hides
   *  the confirmed pill immediately (semi-transparent removal isn't a thing — it
   *  just vanishes) until the live stream echoes the `removed` event back, at which
   *  point `reactions` no longer carries it and we drop it from this map. */
  const [optimisticRemovals, setOptimisticRemovals] = useState<Map<string, string[]>>(new Map());
  /** Optimistic poll selection: pollMessageId → Set<optionIndex> the local user
   *  just tapped, applied instantly over the confirmed tally until the live
   *  stream echoes the vote reaction back (then the memoized `ownVotes` carries
   *  it and we drop the override). */
  const [optimisticVotes, setOptimisticVotes] = useState<Map<string, Set<number>>>(new Map());
  /** Conversation metadata via TanStack Query — cached by convId so the topnav
   *  title + avatar render instantly on the second open (groupName: null = not
   *  resolved, '' = no name; isGroup gates the title→/group affordance). */
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, isGroup } = useConvMeta(convId);
  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return inboxToAddr[inboxId] ?? null;
  }, [inboxToAddr]);

  /** Resolve peer + member profiles → DM display name + avatar cache-busters. */
  const profilesVersion = usePeerProfiles([peerAddr, ...memberAddrs]);

  /** @-mention candidates surfaced in the composer popup. For groups it's
   *  the member list (sans self); for DMs the lone peer. Reads from the
   *  resolved peerProfiles cache so we always have the latest display name. */
  const mentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const out: { address: string; name: string; cacheBuster: number }[] = [];
    const add = (addr: string | null): void => {
      if (!addr) return;
      const k = addr.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({
        address: addr,
        name: getPeerName(addr) ?? shortAddress(addr),
        cacheBuster: getPeerAvatar(addr) ? 1 : 0,
      });
    };
    if (isGroup) memberAddrs.forEach(add);
    else add(peerAddr);
    return out;
    /** profilesVersion bumps each time peer profiles resolve, so the names
     *  flip from the short-address fallback to the real display name. */
  }, [isGroup, memberAddrs, peerAddr, profilesVersion]);

  const insets = useSafeAreaInsets();
  /** Reanimated-driven keyboard offset shared with the composer's KeyboardStickyView,
   *  so the FlatList wrapper lifts in lockstep (native thread) with the composer.
   *  Match the composer's `height.value - insets.bottom` translate by subtracting
   *  `insets.bottom` here too — otherwise the feed overshoots. Clamp ≥0. */
  const { height: kbHeightShared } = useReanimatedKeyboardAnimation();
  const listWrapperStyle = useAnimatedStyle(() => ({
    marginBottom: Math.max(0, -kbHeightShared.value - insets.bottom),
  }));
  const listRef = useRef<FlatList<HistoryEntry>>(null);

  /** Reaction events decorate their target msg — don't render as their own bubbles. */
  /** Poll message ids → option count — used to keep vote-reactions (content = a
   *  valid option index) out of the emoji pill grouping even when the inbound decode
   *  didn't tag them schema:'custom', while still rendering real emoji reactions. */
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]);
  /** Emojis the local user currently owns per message — toggles un-react in onReact. */
  const ownReactions = useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]);
  /** Poll tallies — confirmed votes per poll message id, and the local user's
   *  selections (drives the checkmark + result bar). */
  const votes = useMemo(() => votesByMessage(events), [events]);
  const ownVotes = useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]);
  /** Once the confirmed tally matches an optimistic selection (same set of
   *  indices), drop the override so the bubble reads purely off the live feed. */
  useEffect(() => {
    setOptimisticVotes(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, Set<number>>();
      for (const [pollId, sel] of prev) {
        const confirmed = ownVotes.get(pollId) ?? new Set<number>();
        const same = sel.size === confirmed.size && [...sel].every(i => confirmed.has(i));
        if (same) { changed = true; continue; }
        next.set(pollId, sel);
      }
      return changed ? next : prev;
    });
  }, [ownVotes]);
  /** Display tallies merge the optimistic selection over the confirmed one so a
   *  tapped option flips instantly: the local voter is added to / removed from
   *  the per-option voter sets, and ownVotes reflects the pending choice. */
  const displayOwnVotes = useMemo(() => {
    if (optimisticVotes.size === 0) return ownVotes;
    const merged = new Map(ownVotes);
    for (const [pollId, sel] of optimisticVotes) merged.set(pollId, sel);
    return merged;
  }, [ownVotes, optimisticVotes]);
  const displayVotes = useMemo(() => {
    if (optimisticVotes.size === 0) return votes;
    const merged = new Map<string, Map<number, Set<string>>>();
    for (const [pollId, tally] of votes) merged.set(pollId, new Map([...tally].map(([i, s]) => [i, new Set(s)])));
    for (const [pollId, sel] of optimisticVotes) {
      const confirmedOwn = ownVotes.get(pollId) ?? new Set<number>();
      let tally = merged.get(pollId);
      if (!tally) { tally = new Map(); merged.set(pollId, tally); }
      /** Remove me from options I no longer hold, add me to the pending ones. */
      for (const idx of confirmedOwn) if (!sel.has(idx)) tally.get(idx)?.delete(myUri);
      for (const idx of sel) {
        let s = tally.get(idx);
        if (!s) { s = new Set(); tally.set(idx, s); }
        s.add(myUri);
      }
    }
    return merged;
  }, [votes, optimisticVotes, ownVotes, myUri]);
  /** Once the live stream confirms an optimistic reaction (emoji now present in
   *  `reactions` for that message), drop it from the pending map so the pill flips
   *  from semi-transparent to the solid confirmed pill. */
  useEffect(() => {
    setOptimisticReactions(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, string[]>();
      for (const [msgId, emojis] of prev) {
        const confirmed = reactions.get(msgId);
        const left = emojis.filter(e => !confirmed?.has(e));
        if (left.length !== emojis.length) changed = true;
        if (left.length) next.set(msgId, left);
      }
      return changed ? next : prev;
    });
    /** Symmetric drop for pending un-reacts: once the live feed no longer carries the
     *  emoji on that message, the removal has confirmed — forget it. */
    setOptimisticRemovals(prev => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map<string, string[]>();
      for (const [msgId, emojis] of prev) {
        const confirmed = reactions.get(msgId);
        const left = emojis.filter(e => confirmed?.has(e));
        if (left.length !== emojis.length) changed = true;
        if (left.length) next.set(msgId, left);
      }
      return changed ? next : prev;
    });
  }, [reactions]);
  const liveBubbles = useMemo(
    () => events.filter(e => !isReaction(e)),
    [events],
  );
  /** Inverted FlatList expects newest-first → put optimistic at the top. Filter out
   *  optimistic entries inline so the streamed-confirmed bubble never renders
   *  alongside its pending twin even for one frame. */
  /** Match optimistic entries to their confirmed live twins.
   *
   *  THE RACE (root cause of the "sent message doesn't show until the stream
   *  confirms it" bug): the old check was `liveBubbles.some(e => same text
   *  within 30s)`. If you'd sent the SAME text in the last 30s, a brand-new
   *  optimistic entry instantly matched that OLD live bubble and got filtered
   *  out of `allBubbles` on the very first render — so it vanished until its
   *  own stream echo arrived seconds later. Duplicate/similar quick sends hit
   *  this every time; that's the intermittency.
   *
   *  Fix: only confirm against live messages that landed AT/AFTER the optimistic
   *  entry's own send time, and consume each live message at most once so two
   *  optimistic entries can't both latch onto a single (possibly older) bubble.
   *  Returns the set of optimistic ids that are now confirmed. */
  const confirmedOptimisticIds = useMemo(() => {
    const confirmed = new Set<string>();
    if (!optimistic.length) return confirmed;
    const used = new Set<string>(); // live message ids already claimed
    /** Oldest optimistic first so earlier sends claim earlier echoes. */
    const ordered = [...optimistic].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
    );
    for (const o of ordered) {
      /** Exact-id confirm: once we know the real id (from onSent) and it's in the
       *  live feed, confirm by id — no false positives, instant + stable. */
      const realId = confirmedIds.get(o.id);
      if (realId) {
        const byId = liveBubbles.find(e => e.id === realId && !used.has(e.id));
        if (byId) { used.add(byId.id); confirmed.add(o.id); continue; }
      }
      const oTs = new Date(o.ts).getTime();
      const match = liveBubbles.find(e =>
        e.from === myUri
        && !used.has(e.id)
        /** Echo must be no earlier than this send (1s slack for clock skew) and
         *  within a tight 30s window — never a message that predates the send. */
        && new Date(e.ts).getTime() >= oTs - 1_000
        && new Date(e.ts).getTime() - oTs < 30_000
        && (e.text === o.text || (hasAttachments(o) && hasAttachments(e))));
      if (match) { used.add(match.id); confirmed.add(o.id); }
    }
    return confirmed;
  }, [liveBubbles, optimistic, myUri, confirmedIds]);
  const allBubbles = useMemo(() => {
    if (!optimistic.length) return liveBubbles;
    return [...optimistic.filter(o => !confirmedOptimisticIds.has(o.id)), ...liveBubbles];
  }, [liveBubbles, optimistic, confirmedOptimisticIds]);
  /** Once the live feed has caught up, drop the now-dead optimistic entries from state. */
  useEffect(() => {
    if (!optimistic.length) return;
    const live = optimistic.filter(o => !confirmedOptimisticIds.has(o.id));
    if (live.length !== optimistic.length) {
      setOptimistic(live);
      /** Forget any id mappings for the dropped entries so the map can't grow unbounded. */
      setConfirmedIds(prev => {
        if (prev.size === 0) return prev;
        let changed = false;
        const next = new Map(prev);
        for (const o of optimistic) {
          if (confirmedOptimisticIds.has(o.id) && next.delete(o.id)) changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [optimistic, confirmedOptimisticIds]);
  /** Sticky-bottom for inbound messages: when a new entry arrives and the user is
   *  already at the visual bottom (`showJump=false` means scroll offset ≤ 12px),
   *  remount the list so it lands at offset 0 again. Skip on initial mount. */
  const prevBubbleCount = useRef(0);
  useEffect(() => {
    if (allBubbles.length > prevBubbleCount.current && prevBubbleCount.current > 0) {
      /** New message arrived while we were at the visual bottom — keep us pinned
       *  by force-remounting + clearing the jump-button. Without the explicit
       *  setShowJump(false) the inverted list sometimes reports a stale large
       *  offset after maintainVisibleContentPosition shifts content, leaving
       *  the button visible despite the user being at offset 0. */
      if (!showJump) {
        setListEpoch(e => e + 1);
      }
      setShowJump(false);
    }
    prevBubbleCount.current = allBubbles.length;
  }, [allBubbles.length, showJump]);
  const previewOf = (e: HistoryEntry): string =>
    (e.text ? stripMentionMarkup(e.text).slice(0, 80) : '')
    || (() => {
      const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
      return attachmentEmojiPreview(a?.mime, a?.name);
    })();
  /** Jump to the original of a quoted/replied-to message: scroll the inverted
   *  list to its row + flash a highlight. The scroll is best-effort — wrapped in
   *  try/catch with `animated:false` (reanimated #3670 makes the animated path
   *  throw on Reduce-Motion devices) and backed by the list's
   *  `onScrollToIndexFailed` no-op for not-yet-rendered rows. The highlight
   *  always fires so the user gets feedback even when the scroll can't land. */
  const jumpToMessage = useCallback((messageId: string) => {
    const idx = allBubbles.findIndex(b => b.id === messageId);
    setJumpHighlightId(messageId);
    if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current);
    jumpClearTimer.current = setTimeout(() => setJumpHighlightId(null), 1800);
    if (idx < 0) return;
    try {
      listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
    } catch { /* reanimated #3670 / row not rendered — highlight is the feedback */ }
  }, [allBubbles]);
  useEffect(() => () => { if (jumpClearTimer.current) clearTimeout(jumpClearTimer.current); }, []);

  const onReact = useCallback((messageId: string, emoji: string) => {
    /** Toggle: if the user already owns this emoji on this message (confirmed in the
     *  live feed, and not already optimistically removed), re-selecting / tapping the
     *  pill sends `removed`; otherwise `added`. */
    const alreadyOwned = !!ownReactions.get(messageId)?.has(emoji)
      && !(optimisticRemovals.get(messageId)?.includes(emoji));
    const action: 'added' | 'removed' = alreadyOwned ? 'removed' : 'added';

    if (action === 'removed') {
      /** Optimistic un-react: hide the pill immediately. */
      setOptimisticRemovals(prev => {
        const cur = prev.get(messageId) ?? [];
        if (cur.includes(emoji)) return prev;
        const next = new Map(prev);
        next.set(messageId, [...cur, emoji]);
        return next;
      });
      /** Also clear any not-yet-confirmed optimistic add for the same pair. */
      setOptimisticReactions(prev => {
        const cur = prev.get(messageId);
        if (!cur?.includes(emoji)) return prev;
        const left = cur.filter(e => e !== emoji);
        const next = new Map(prev);
        if (left.length) next.set(messageId, left); else next.delete(messageId);
        return next;
      });
      const undo = (): void => setOptimisticRemovals(prev => {
        const cur = prev.get(messageId);
        if (!cur) return prev;
        const left = cur.filter(e => e !== emoji);
        const next = new Map(prev);
        if (left.length) next.set(messageId, left); else next.delete(messageId);
        return next;
      });
      void xmtpReact(activeLine, messageId, emoji, 'removed')
        .catch((e: unknown) => { console.warn('xmtp un-react failed', e); undo(); });
      return;
    }

    /** Optimistic reaction: drop the pill in immediately (semi-transparent) before
     *  the XMTP send resolves, then let the live stream solidify it. Dedup by
     *  messageId+emoji so re-tapping the same emoji doesn't stack duplicates. */
    setOptimisticReactions(prev => {
      const cur = prev.get(messageId) ?? [];
      if (cur.includes(emoji)) return prev;
      const next = new Map(prev);
      next.set(messageId, [...cur, emoji]);
      return next;
    });
    const dropPending = (): void => setOptimisticReactions(prev => {
      const cur = prev.get(messageId);
      if (!cur) return prev;
      const left = cur.filter(e => e !== emoji);
      const next = new Map(prev);
      if (left.length) next.set(messageId, left); else next.delete(messageId);
      return next;
    });
    void xmtpReact(activeLine, messageId, emoji, 'added')
      .catch((e: unknown) => { console.warn('xmtp react failed', e); dropPending(); });
  }, [activeLine, ownReactions, optimisticRemovals]);

  /** Cast/retract a poll vote. Computes the next selection set optimistically
   *  (single-select = exactly this option or none; multi = toggle), drops it into
   *  `optimisticVotes` for instant UI, then sends. Single-select switching also
   *  retracts the previously-held option so the cross-device tally converges
   *  without relying solely on last-write-wins. */
  /** Message ids whose signature is currently being produced — drives the
   *  Sign-button spinner. */
  const [signingIds, setSigningIds] = useState<Set<string>>(new Set());

  /** Sign an in-chat signature request. For `eip712` we route the typed data
   *  through wagmi `signTypedData`; for `personal` through `signMessage`. On
   *  success we post a SignatureReference back into the SAME conversation so the
   *  request card flips to a "Signed ✓" receipt for everyone. */
  const onSign = useCallback((requestId: string, req: SignatureRequestContent) => {
    setSigningIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /** Bind every signature to the wallet the rest of the app uses — the
         *  active Reown/wagmi account. Passing `account` explicitly stops wagmi
         *  from falling back to the connector's "current" account (which inside a
         *  list-rendered bubble may not be the live one). */
        /** Prefer the in-app key: if the active account is a local EOA
         *  (generated/imported/migrated) we sign with its viem account directly,
         *  no popup. Only when there's no local key (WalletConnect account) do we
         *  delegate to the remote wallet through wagmi. */
        const local = await getActiveViemAccount();
        const account = local?.address ?? getAccount(wagmiConfig).address;
        if (!account) throw new Error('Connect a wallet to sign');
        let signature: string;
        if (req.kind === 'eip712') {
          const td = req.eip712;
          if (!td) throw new Error('Malformed typed-data request');
          /** viem/wagmi inject the EIP712Domain entry themselves from `domain`;
           *  a duplicate in `types` makes them reject the request. Strip it. */
          const { EIP712Domain: _drop, ...types } = (td.types ?? {}) as Record<string, unknown>;
          signature = local
            ? await local.signTypedData({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                domain: td.domain as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                types: types as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                primaryType: td.primaryType as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                message: td.message as any,
              })
            : await signTypedData(wagmiConfig, {
                account,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                domain: td.domain as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                types: types as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                primaryType: td.primaryType as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                message: td.message as any,
              });
        } else {
          const message = req.message ?? '';
          if (!message) throw new Error('Empty message to sign');
          signature = local
            ? await local.signMessage({ message })
            : await signMessage(wagmiConfig, { account, message });
        }
        const signer = account;
        const ref: SignatureReferenceContent = { requestId, signature, signer };
        await xmtpSendSignatureReference(activeLine, ref);
      } catch (e) {
        flash((e as Error).message || 'Signing failed');
      } finally {
        setSigningIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      }
    })();
  }, [activeLine]);

  const onVote = useCallback((pollMessageId: string, optionIndex: number, action: 'added' | 'removed') => {
    const multi = pollsInFeed(events).get(pollMessageId) === true;
    const current = optimisticVotes.get(pollMessageId)
      ?? ownVotes.get(pollMessageId)
      ?? new Set<number>();
    const next = new Set(current);
    if (action === 'removed') {
      next.delete(optionIndex);
    } else if (multi) {
      next.add(optionIndex);
    } else {
      next.clear();
      next.add(optionIndex);
    }
    setOptimisticVotes(prev => { const m = new Map(prev); m.set(pollMessageId, next); return m; });

    const undo = (): void => setOptimisticVotes(prev => {
      const m = new Map(prev); m.delete(pollMessageId); return m;
    });
    /** Single-select switch: retract every previously-held option that isn't the
     *  new pick so other clients don't double-count. */
    if (!multi && action === 'added') {
      for (const prevIdx of current) {
        if (prevIdx !== optionIndex) {
          void xmtpVote(activeLine, pollMessageId, prevIdx, 'removed')
            .catch((e: unknown) => console.warn('xmtp vote-retract failed', e));
        }
      }
    }
    void xmtpVote(activeLine, pollMessageId, optionIndex, action)
      .catch((e: unknown) => { console.warn('xmtp vote failed', e); undo(); });
  }, [activeLine, events, optimisticVotes, ownVotes]);

  /** Message ids whose payment is currently broadcasting — drives the Pay
   *  spinner. */
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());

  /** Pay an in-chat payment request. Broadcasts the first call via the phase-3
   *  sendTx helper (native ETH or ERC-20 transfer decoded from the call), then
   *  posts a TransactionReference back into the SAME conversation so the request
   *  card flips to a receipt for everyone. */
  const onPay = useCallback((requestId: string, wsc: WalletSendCallsContent) => {
    const call = wsc.calls?.[0];
    if (!call?.to) { flash('Malformed payment request'); return; }
    const chainId = chainIdToNumber(wsc.chainId);
    setPayingIds(prev => new Set(prev).add(requestId));
    void (async () => {
      try {
        /** Native transfer: value is hex wei → decimal ETH for the helper.
         *  (ERC-20 `data` paths aren't built by the composer yet; value-only
         *  native sends are the supported request shape.) */
        const wei = BigInt(call.value ?? '0x0');
        const amount = (Number(wei) / 1e18).toString();
        const txHash = await sendNativeOrToken({ to: call.to as string, amount, chainId });
        const ref: TransactionReferenceContent = {
          networkId: chainId,
          reference: txHash,
          metadata: {
            transactionType: 'transfer',
            currency: call.metadata?.currency ?? 'ETH',
            ...(call.metadata?.amount != null ? { amount: call.metadata.amount } : {}),
            decimals: 18,
            toAddress: call.to as string,
          },
        };
        await xmtpSendTxReference(activeLine, ref);
      } catch (e) {
        flash((e as Error).message || 'Payment failed');
      } finally {
        setPayingIds(prev => { const n = new Set(prev); n.delete(requestId); return n; });
      }
    })();
  }, [activeLine]);

  /** DM "Open as bubble" — pop a floating Android chat-head for this 1-1.
   *  Graceful no-op + toast if the native module/bubbles aren't available
   *  (handled inside `openConversationAsBubble`). */
  const onOpenAsBubble = useCallback(() => {
    setOverflowOpen(false);
    if (!convId || !peerAddr) return;
    void openConversationAsBubble({
      convId,
      peerName: getPeerName(peerAddr) ?? shortAddress(peerAddr),
      peerAddress: peerAddr,
    });
  }, [convId, peerAddr]);

  /** DM "Float as pill" — launch the always-on floating voice pill targeting
   *  THIS peer. Records push-to-talk voice clips straight to their DM + shows
   *  their unread badge. Ensures the overlay permission first (the grant has no
   *  callback, so we toast + bail; the user re-taps after granting). */
  const onFloatAsPill = useCallback(() => {
    setOverflowOpen(false);
    if (!convId || !peerAddr) return;
    if (!hasOverlayPermission()) {
      void requestOverlayPermission();
      flash('Allow “Display over other apps”, then tap Float as pill again');
      return;
    }
    const unread = getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0;
    void showPill(peerAddr, null, unread);
  }, [convId, peerAddr]);

  if (!convId) {
    return (
      <Box style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Text style={{ color: sub }}>Missing conversation id.</Text>
      </Box>
    );
  }

  return (
    <RNAnimated.View
      style={{
        flex: 1, backgroundColor: bg, paddingBottom: insets.bottom,
      }}
    >
      <Reanimated.View style={[{ flex: 1 }, listWrapperStyle]}>
      <FlatList
        key={listEpoch}
        ref={listRef}
        data={allBubbles}
        extraData={[profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, confirmedIds]}
        inverted
        showsVerticalScrollIndicator={false}
        /** Anchor the bottom-visible item (= newest on inverted) so as new bubbles or the
         *  initial seed lands, scroll stays pinned to the latest message. */
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyExtractor={e => e.id}
        style={{ flex: 1 }}
        /** #5 FlatList perf: bubbles are VARIABLE height (text/attachments/
         *  reactions) so no getItemLayout — but cap the render window + batch
         *  size + clip offscreen rows so a long thread doesn't mount every
         *  bubble at once on open. */
        windowSize={11}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        /** Inverted list: onEndReached fires near the visual TOP (the OLDEST end),
         *  which is exactly when we want to page in older history. loadOlder() reads
         *  the oldest loaded event's ts as a before-cursor and appends the next page
         *  to the END of the data array — on an inverted list that adds rows above
         *  the current view without moving the viewport. No-ops while loading or
         *  once history is exhausted (guarded inside the hook). */
        onEndReached={() => { void loadOlder(); }}
        onEndReachedThreshold={0.5}
        /** Inverted: paddingTop = visual BOTTOM (composer side), paddingBottom = visual TOP
         *  (nav side). Bump the top so the oldest message clears the absolute top-nav strip. */
        contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.top + 52 + 24 }}
        /** Inverted list: `contentOffset.y` is ~0 at the visual bottom. Hide the
         *  jump button within ~12px of the bottom (so it never lingers when the
         *  user is already down) and show it the moment they scroll up past that.
         *  `scrollEventThrottle={16}` (≈1 event/frame) keeps the show/hide snappy
         *  instead of the laggy 32ms cadence. */
        onScroll={(ev) => {
          const next = ev.nativeEvent.contentOffset.y > 12;
          setShowJump(prev => (prev === next ? prev : next));
        }}
        scrollEventThrottle={16}
        /** Silent fallback — `scrollToIndex` on a virtualised inverted list
         *  can fire before the target row has rendered. Without this handler
         *  RN's red-screen pops on the dev build. We just no-op; the bubble
         *  still highlights via `replyTarget`, so the user finds it on
         *  manual scroll. */
        onScrollToIndexFailed={() => undefined}
        renderItem={({ item }) => (
          <MessengerBubble
            entry={item}
            dark={dark}
            myUri={myUri}
            senderEthAddress={senderEthOf(item.from)}
            onAvatarPress={(addr) => router.push({ pathname: '/user/[address]', params: { address: addr } })}
            unread={false}
            /** Dim ("sending") only while the send is still in flight: an optimistic
             *  entry (id `tmp_…`) whose real id has NOT yet come back from conv.send().
             *  The moment onSent resolves with a sentId we record it in confirmedIds,
             *  which flips this to solid immediately — no waiting for the stream echo
             *  (XMTP self-sends don't reliably replay, esp. in groups). The optimistic
             *  entry is still dropped/merged by id when the live bubble lands, so this
             *  never produces a duplicate. */
            pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
            replyTarget={replyingTo?.id === item.id || jumpHighlightId === item.id}
            reactions={reactions.get(item.id)}
            pendingReactions={optimisticReactions.get(item.id)}
            pendingRemovals={optimisticRemovals.get(item.id)}
            ownEmojis={ownReactions.get(item.id)}
            replyPreview={item.replyTo ? previewOf(events.find(e => e.id === item.replyTo) ?? item) : undefined}
            /** Tap the quoted slab → jump+highlight the original message. */
            onReplyPreviewPress={item.replyTo ? () => jumpToMessage(item.replyTo as string) : undefined}
            votes={displayVotes.get(item.id)}
            ownVotes={displayOwnVotes.get(item.id)}
            onVote={(idx, action) => onVote(item.id, idx, action)}
            signing={signingIds.has(item.id)}
            /** Show "Sign" only on a request from the OTHER party — you don't
             *  sign your own request. */
            onSign={(() => {
              const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
              if (!req || item.from === myUri) return undefined;
              return () => onSign(item.id, req);
            })()}
            paying={payingIds.has(item.id)}
            /** Show "Pay" only on a payment request from the OTHER party — you
             *  don't pay your own request. */
            onPay={(() => {
              const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
              if (!wsc || item.from === myUri) return undefined;
              return () => onPay(item.id, wsc);
            })()}
            onReact={(emoji) => onReact(item.id, emoji)}
            onReply={() => setReplyTarget(item.id, previewOf(item), senderEthOf(item.from))}
            onOpenMenu={(anchor) => { setMenuAnchor(anchor); setMenuFor(item); }}
            onCloseMenu={() => setMenuFor(null)}
            onAnswer={(label) => {
              void xmtpReply(activeLine, item.id, label)
                .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
            }}
          />
        )}
        ListEmptyComponent={
          <Box style={{ padding: 32, alignItems: 'center' }}>
            {status === 'open'
              ? <Text style={{ color: sub }}>Type a message below to start chatting.</Text>
              : <Spinner size={28} color={head} />}
          </Box>
        }
        /** Inverted list → `ListFooterComponent` renders at the visual TOP (oldest
         *  end). Holds two things, top-to-bottom: a small "loading older" spinner
         *  while a previous page is paginating in, then the DM intro banner.
         *  The DM banner only shows once history is exhausted (`!hasMore`) so it
         *  doesn't sit mid-scroll above still-unloaded messages. */
        ListFooterComponent={
          <>
            {loadingOlder ? (
              <Box style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Spinner size={20} color={sub} />
              </Box>
            ) : null}
            {!isGroup && peerAddr && hasMore === false ? (
              <Pressable
                onPress={() => router.push({ pathname: '/user/[address]', params: { address: peerAddr } })}
                style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 }}
              >
                <Avatar
                  address={peerAddr}
                  imageUri={getPeerAvatar(peerAddr)}
                  size="lg"
                  style={{ backgroundColor: border }}
                />
                <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginTop: 12 }} numberOfLines={1}>
                  {getPeerName(peerAddr) ?? shortAddress(peerAddr)}
                </Text>
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
                  {shortAddress(peerAddr)}
                </Text>
              </Pressable>
            ) : null}
          </>
        }
        keyboardShouldPersistTaps="handled"
      />
      </Reanimated.View>
      {/** Top nav: solid bg strip mirrors the composer footer + extends UP to cover the
       *  status-bar area, so content sliding up under the keyboard doesn't show through
       *  behind the system icons. */}
      <Box style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        height: 52 + insets.top, paddingTop: insets.top, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'stretch',
        borderBottomWidth: 1, borderBottomColor: dark ? '#282a2d' : '#e4e4e5',
      }}>
        <Pressable
          onPress={() => router.replace('/')}
          style={{ paddingLeft: 14, paddingRight: 8, justifyContent: 'center' }}
        >
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        {/** Everything right of the back arrow is one tap target → the
         *   group/channel detail page (or the peer's profile for a DM).
         *   Fills full height + to the right edge so 100% is clickable. */}
        <Pressable
          onPress={() => {
            if (isGroup) router.push({ pathname: '/group/[convId]', params: { convId: convId ?? '' } });
            else if (peerAddr) router.push({ pathname: '/user/[address]', params: { address: peerAddr } });
          }}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 }}
        >
          <HeaderAvatar peerAddr={peerAddr} groupImage={groupImage} border={dark ? '#282a2d' : '#e4e4e5'} />
          <Text style={{ color: head, fontSize: 19, fontFamily: 'Calibre-Semibold', flex: 1 }} numberOfLines={1}>
            {isGroup ? (groupName === null ? '' : (groupName || 'Untitled group'))
              : peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : ''}
          </Text>
        </Pressable>
        {/** Overflow (3-dot) menu — shared ChannelMenu. Always shown: every conv
         *   has Mark read/unread + Pin/Unpin + Group info / Profile; groups add
         *   Leave group, DMs add Open as bubble / Float as pill (pill module). */}
        <Pressable
          onPress={() => setOverflowOpen(true)}
          hitSlop={8}
          style={{ paddingHorizontal: 14, justifyContent: 'center' }}
        >
          <Icon name="dotsVertical" size={22} color={fg} />
        </Pressable>
      </Box>
      {/** Fade strip below the top nav — mirrors the composer's top fade. The nav is
       *  `52 + insets.top` tall; start the fade 1px higher so its solid-bg top edge
       *  overlaps the nav bottom by 1px, closing the hairline seam between the two
       *  absolute bg layers (the "1px missing"). The fade then ramps down to
       *  transparent over the content beneath. */}
      <ComposerGradient bg={bg} direction="up" top={52 + insets.top - 1} height={24} />
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <Box>
      {/** Jump-to-bottom: anchored just above the composer (bottom:'100%') and inside
       *   the KeyboardStickyView, so it tracks the composer's height + the keyboard
       *   instead of a fixed offset that floated in the middle of a tall composer.
       *   Bump the FlatList key to remount → inverted offset 0 = newest at the bottom. */}
      {showJump ? (
        <Pressable
          onPress={() => { setListEpoch(e => e + 1); setShowJump(false); }}
          style={{
            position: 'absolute', alignSelf: 'center', bottom: '100%', marginBottom: 8, zIndex: 3,
            width: 36, height: 36, borderRadius: 999,
            backgroundColor: dark ? rowBg : '#000000',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="arrowDown" size={18} color="#ffffff" />
        </Pressable>
      ) : null}
      <MessengerComposer
        dark={dark}
        xmtpLine={activeLine}
        mentionCandidates={mentionCandidates}
        replyingTo={replyingTo ?? undefined}
        autoFocusNonce={autoFocusNonce}
        onClearReply={() => setReplyingTo(null)}
        onReplyPreviewPress={() => {
          /** Tapping the composer's "Replying to …" slab jumps the feed to the
           *  target bubble + flashes its highlight, sharing the same best-effort
           *  scroll path as tapping a quoted preview in a bubble (guarded
           *  `scrollToIndex` + `onScrollToIndexFailed` no-op for reanimated
           *  #3670 / not-yet-rendered rows). */
          if (replyingTo) jumpToMessage(replyingTo.id);
        }}
        onOptimistic={({ localId, text, attachments, replyTo, payload }) => {
          /** Inverted FlatList + `maintainVisibleContentPosition` + prepended optimistic
           *  entry = bubble appears at the visual bottom automatically. */
          setOptimistic(prev => [{
            id: localId, ts: new Date().toISOString(),
            station: 'xmtp', line: activeLine,
            from: myUri, to: activeLine,
            text: text || undefined,
            ...(replyTo ? { replyTo } : {}),
            ...(payload ? { payload } : attachments.length ? { payload: { attachments } } : {}),
          } as HistoryEntry, ...prev]);
          /** Always remount so the user lands on their own bubble — `maintainVisibleContentPosition`
           *  anchors the previously-visible content and the new entry falls below the viewport. */
          setListEpoch(e => e + 1);
          setShowJump(false);
          /** Patch the channels-list cache right away so the just-sent message
           *  shows as the latest preview when the user goes back — XMTP
           *  self-sends don't reliably replay through `streamAllMessages`, so
           *  the list would otherwise lag until the next 30s poll / app resume. */
          const preview = text.trim() || attachmentEmojiPreview(attachments[0]?.mime, attachments[0]?.name);
          if (convId) patchRowSent(convId, preview);
        }}
        onSent={(localId, _error, sentId) => {
          /** conv.send() resolves with the real XMTP message id — thread it back so
           *  the dedup memo confirms this optimistic entry by EXACT id when it shows
           *  up in the live feed (no text+timestamp guessing). We DON'T drop the
           *  optimistic entry here anymore: dropping it before the live echo arrives
           *  made the just-sent bubble vanish for a frame. The dedup effect drops it
           *  once the matching live bubble lands (by id, else the ts fallback). On a
           *  send error (no id) keep the old behavior: drop the stranded bubble. */
          if (sentId) {
            setConfirmedIds(prev => {
              const next = new Map(prev);
              next.set(localId, sentId);
              return next;
            });
          } else {
            setOptimistic(prev => prev.filter(o => o.id !== localId));
          }
        }}
      />
      </Box>
      </KeyboardStickyView>
      {/** Topnav overflow menu — the shared ChannelMenu bottom sheet. */}
      <ChannelMenu
        visible={overflowOpen}
        convId={convId ?? ''}
        title={isGroup ? (groupName || undefined) : (peerAddr ? (getPeerName(peerAddr) ?? shortAddress(peerAddr)) : undefined)}
        isGroup={isGroup}
        peerAddress={peerAddr}
        isUnread={(getCachedRows()?.find(r => r.convId === convId)?.unreadCount ?? 0) > 0}
        isPinned={convId ? isPinned(convId) : false}
        onClose={() => setOverflowOpen(false)}
        context="view"
        onAfterLeave={result => flash(result === 'left' ? 'Left group' : 'Group hidden')}
        onOpenAsBubble={pillAvailable ? onOpenAsBubble : undefined}
        onFloatAsPill={pillAvailable ? onFloatAsPill : undefined}
      />
      <BubbleActionMenu
        target={menuFor}
        anchor={menuAnchor}
        dark={dark}
        onClose={() => setMenuFor(null)}
        onReact={emoji => { if (menuFor) onReact(menuFor.id, emoji); setMenuFor(null); }}
        onReply={() => {
          if (menuFor) setReplyTarget(menuFor.id, previewOf(menuFor), senderEthOf(menuFor.from));
          setMenuFor(null);
        }}
        onCopy={() => {
          if (menuFor?.text) void Clipboard.setStringAsync(menuFor.text);
          setMenuFor(null);
        }}
        onShareLink={() => {
          /** Shareable permalink to this message. Opens the conversation on the
           *  web today; the metro:// universal-link handling is the follow-up. */
          if (menuFor) void Share.share({ message: `https://metro.box/#/xmtp/${convId}?m=${menuFor.id}` });
          setMenuFor(null);
        }}
      />
    </RNAnimated.View>
  );
}

/** Fuller emoji set revealed by the strip's chevron — a quick scrollable row
 *  beyond the 7 presets. Kept inline (no native emoji-keyboard dependency). */
const MORE_EMOJIS = ['❤️', '😂', '😮', '😢', '🎉', '🤯', '🥳', '👏', '🙌', '🤝', '✅', '❌', '👌', '🚀', '💀', '🤔', '😅', '🫶'];

/** Telegram-style anchored message menu: a horizontal emoji-reaction pill floating
 *  just above the tapped message, and a vertical action dropdown just below it, over
 *  a dimmed full-screen backdrop. Positioning is driven by the row's measured
 *  on-screen rect (`anchor`), clamped to the screen so it never runs off the top or
 *  bottom edge. Tapping a strip emoji reacts + closes; the chevron reveals more
 *  emojis; any action or an outside tap dismisses. */
function BubbleActionMenu({
  target, anchor, dark, onClose, onReact, onReply, onCopy, onShareLink,
}: {
  target: HistoryEntry | null; anchor: { y: number; height: number };
  dark: boolean; onClose: () => void;
  onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void;
  onShareLink: () => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!target) setExpanded(false); }, [target]);

  const fg = dark ? '#e7e7ea' : '#1f2328';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const cardBg = dark ? '#21262b' : '#ffffff';
  const stripBg = dark ? '#21262b' : '#ffffff';
  const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const screenH = Dimensions.get('window').height;
  /** Strip + dropdown are ONE cohesive stacked unit rendered in a single absolute
   *  column: emoji strip on top, a literal GAP-px spacer, then the action dropdown
   *  directly below. Because the dropdown follows the strip's REAL rendered height
   *  in normal flow, the only vertical space between them is exactly GAP — no
   *  hard-coded strip-height estimate. The column is anchored near the tapped
   *  message and clamped so its bottom never runs off-screen past the composer /
   *  safe area (clamp uses an ESTIMATED total height; the strip↔card gap stays
   *  the literal GAP regardless). */
  const actionCount = 2 + (target?.text ? 1 : 0);
  const cardH = actionCount * 48 + 16;       // estimated dropdown height (clamp only)
  const stripH = 40;                          // estimated strip height (clamp only)
  const GAP = 6;                              // literal gap between strip and dropdown
  const TOP_MARGIN = 40;                      // min top inset
  const BOTTOM_MARGIN = 40;                   // keep clear of composer / safe area
  const unitH = stripH + GAP + cardH;         // estimated total height (clamp only)
  /** Anchor the top of the unit near the message top; clamp into screen bounds. */
  const maxTop = screenH - BOTTOM_MARGIN - unitH;
  const stripTop = Math.max(TOP_MARGIN, Math.min(anchor.y, maxTop));

  const reactAndClose = (e: string): void => { onReact(e); onClose(); };

  const ActionRow = ({ icon, label, color, onPress }: {
    icon: React.ComponentProps<typeof Icon>['name']; label: string; color?: string; onPress: () => void;
  }): React.ReactElement => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 13, paddingHorizontal: 16,
        backgroundColor: pressed ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
      })}
    >
      <Icon name={icon} size={20} color={color ?? fg} />
      <Text style={{ color: color ?? fg, fontSize: 16, fontFamily: 'Calibre-Medium' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!target} transparent animationType="none" onRequestClose={onClose}>
      {/** Dimmed full-screen backdrop — tap anywhere outside the cards to dismiss. */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        {/** Strip + dropdown as one absolute column. The dropdown sits directly
          *  below the strip's REAL height + a literal GAP spacer — no stripH math. */}
        <View
          style={{
            position: 'absolute', left: 12, right: 12, top: stripTop,
            alignItems: 'flex-start',
          }}
          pointerEvents="box-none"
        >
          {/** Emoji reaction strip — rounded pill floating above the message. */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: stripBg, borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 6,
            shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
            maxWidth: '100%',
          }}>
            {expanded ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
                {[...REACT_PRESETS, ...MORE_EMOJIS].map(e => (
                  <Pressable key={e} onPress={() => reactAndClose(e)} hitSlop={4}>
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                {REACT_PRESETS.map(e => (
                  <Pressable key={e} onPress={() => reactAndClose(e)} hitSlop={4} style={{ paddingHorizontal: 2 }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setExpanded(true)}
                  hitSlop={6}
                  style={{
                    width: 30, height: 30, borderRadius: 999, marginLeft: 2,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
                  }}
                >
                  <Icon name="chevronDown" size={16} color={sub} />
                </Pressable>
              </>
            )}
          </View>

          {/** Literal gap — the ONLY vertical space between strip and dropdown. */}
          <View style={{ height: GAP }} pointerEvents="none" />

          {/** Action dropdown — rounded card directly below the strip. */}
          <View
            style={{
              minWidth: 220, maxWidth: 320,
              backgroundColor: cardBg, borderRadius: 14, paddingVertical: 4, overflow: 'hidden',
              shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
            }}
          >
            <ActionRow icon="reply" label="Reply" onPress={onReply} />
            {target?.text ? <View style={{ height: 1, backgroundColor: divider, marginLeft: 16 }} /> : null}
            {target?.text ? <ActionRow icon="copy" label="Copy" onPress={onCopy} /> : null}
            <View style={{ height: 1, backgroundColor: divider, marginLeft: 16 }} />
            <ActionRow icon="send" label="Share link" onPress={onShareLink} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
