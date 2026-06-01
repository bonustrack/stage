/** State + side-effects + action wiring for the XMTP conversation screen —
 *  extracted from app/xmtp/[convId].tsx (phase-2 lint split). The route component
 *  owns only the render tree. Optimistic reaction / vote / tx-sign sub-layers live
 *  in their own hooks. Behavior, effect ordering, and memo deps are identical to
 *  the original inline version. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles, getPeerName, getPeerAvatar } from '../../lib/peerProfiles';
import { useConvMeta } from '../../lib/useConvMeta';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReply, shortAddress,
} from '../../lib/xmtp';
import { setActiveConversation } from '../../modules/metro-pill';
import { markConvRead } from '../../lib/channelsCache';
import { convScrollKey, getScrollOffset, flushScrollOffset } from '../../lib/scrollPos';
import type { HistoryEntry } from '../../lib/types';
import {
  reactionsByMessage, ownReactionsByMessage,
  pollOptionCountsInFeed, votesByMessage, ownVotesByMessage,
} from './feed-helpers';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { useOutboundLayer } from './useOutboundLayer';

export function useConversationState(convId: string | undefined, focus: string | undefined) {
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
   *  Native no-ops the call off-Android / on pre-module builds.
   *
   *  CASE NORMALISATION (the suppression bug): the native FCM service does an
   *  EXACT-string `active_conv == data.convId` compare. The value the daemon
   *  sends (`parseLine(line).convId`, from the node-sdk `conversation.id`) and
   *  the value this screen stores (the route param, from the RN-sdk
   *  `Conversation.id`) are both the MLS group-id hex — but the two SDKs are NOT
   *  guaranteed to return the SAME case, so a mixed-case skew makes the exact
   *  compare never match and the push for the open conversation still fires.
   *  Lowercasing here + on the daemon side (xmtp-push-title) makes the native
   *  exact compare case-insensitive WITHOUT a new APK. */
  const activeConvId = useMemo(() => convId?.toLowerCase(), [convId]);
  useFocusEffect(useCallback(() => {
    if (!activeConvId) return;
    setActiveConversation(activeConvId);
    const sub = AppState.addEventListener('change', (s) => {
      setActiveConversation(s === 'active' ? activeConvId : null);
    });
    return () => {
      sub.remove();
      setActiveConversation(null);
    };
  }, [activeConvId]));
  const status: 'idle' | 'connecting' | 'open' | 'error' = xmtpFeed.status === 'open' ? 'open'
    : xmtpFeed.status === 'loading' ? 'connecting'
      : xmtpFeed.status === 'error' ? 'error' : 'idle';
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

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
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** On-screen rect of the tapped message row — drives where the anchored
   *  Telegram-style menu (emoji strip + action dropdown) floats. */
  const [menuAnchor, setMenuAnchor] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  /** Topnav overflow (3-dot) menu — groups show "Leave group"; DMs show
   *  "Open as bubble" (Android, when the native pill/bubble module is linked). */
  const [overflowOpen, setOverflowOpen] = useState(false);
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

  /** Per-conversation scroll persistence. The list is INVERTED, so
   *  `contentOffset.y` is the distance scrolled UP from the newest message
   *  (0 = pinned to bottom/newest) — restoring that same offset lands on the
   *  same content. We restore only ONCE, on the very first content layout after
   *  mount, and only if a saved offset exists; otherwise the default (bottom)
   *  stands. Remounts via listEpoch (jump-to-bottom, sticky-bottom on new msg)
   *  deliberately skip restore so they land at the bottom as before. */
  const savedScrollRef = useRef<number | undefined>(undefined);
  const savedScrollLoaded = useRef(false);
  const didRestoreScroll = useRef(false);
  useEffect(() => {
    if (!convId) return;
    void getScrollOffset(convScrollKey(convId)).then(o => {
      savedScrollRef.current = o; savedScrollLoaded.current = true;
    });
    return () => { flushScrollOffset(convScrollKey(convId)); };
  }, [convId]);

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

  /** Optimistic sub-layers — reactions/un-reacts, poll votes, sign/pay handlers. */
  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, reactions, ownReactions);
  const { displayVotes, displayOwnVotes, onVote } = useVotesLayer(activeLine, events, votes, ownVotes, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  /** Optimistic outbound + inverted-list scroll/jump layer. */
  const {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine);

  /** Inbound onAnswer (quick-reply button) — posts the chosen label as a reply. */
  const onAnswer = useCallback((messageId: string, label: string) => {
    void xmtpReply(activeLine, messageId, label)
      .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
  }, [activeLine]);

  return {
    activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, status, myUri,
    showJump, setShowJump, listEpoch, setListEpoch,
    replyingTo, setReplyingTo, setReplyTarget, jumpHighlightId,
    menuFor, setMenuFor, menuAnchor, setMenuAnchor, overflowOpen, setOverflowOpen,
    confirmedIds, optimisticReactions, optimisticRemovals,
    peerAddr, groupName, groupImage, isGroup, senderEthOf,
    profilesVersion, mentionCandidates, listRef,
    savedScrollRef, savedScrollLoaded, didRestoreScroll,
    reactions, ownReactions, displayVotes, displayOwnVotes,
    allBubbles, jumpToMessage,
    onReact, onSign, signingIds, onVote, onPay, payingIds, onAnswer,
    onOptimistic, onSent,
  };
}
