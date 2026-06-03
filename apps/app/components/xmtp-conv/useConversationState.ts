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
import { setActiveConvId } from '../../lib/activeConv';
import { markConvRead, getCachedRows, subscribeCachedRows } from '../../lib/channelsCache';
import { getGithubLink } from '../../lib/xmtp.github';
import { getGroupLabels } from '../../lib/xmtp.labels';
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
  /** When opened with `?focus=1`, a one-shot nonce drives the composer autofocus. */
  const autoFocusNonce = useMemo(() => (focus ? Date.now() : undefined), [focus]);

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  const { loadOlder, hasMore, loadingOlder } = xmtpFeed;
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId); // mark read when the latest event count changes
  }, [convId, events.length]);
  /** Tell native + JS which conversation is on-screen so the FCM + foreground
   *  rich-notif paths suppress its notification. Lowercase the id since the
   *  native FCM service does an exact-string compare that's case-sensitive. */
  const activeConvId = useMemo(() => convId?.toLowerCase(), [convId]);
  useFocusEffect(useCallback(() => {
    if (!activeConvId) return;
    setActiveConversation(activeConvId);
    setActiveConvId(activeConvId);
    const sub = AppState.addEventListener('change', (s) => {
      const open = s === 'active' ? activeConvId : null;
      setActiveConversation(open);
      setActiveConvId(open);
    });
    return () => {
      sub.remove();
      setActiveConversation(null);
      setActiveConvId(null);
    };
  }, [activeConvId]));
  const status: 'idle' | 'connecting' | 'open' | 'error' = xmtpFeed.status === 'open' ? 'open'
    : xmtpFeed.status === 'loading' ? 'connecting'
      : xmtpFeed.status === 'error' ? 'error' : 'idle';
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  /** `nonce` bumps on every reply action so the composer's focus effect re-fires. */
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string; sender?: string | null; nonce: number } | null>(null);
  /** Monotonic reply counter — fresh `nonce` on EVERY swipe-to-reply. */
  const replyNonceRef = useRef(0);
  const setReplyTarget = useCallback((id: string, preview: string, sender?: string | null) => {
    replyNonceRef.current += 1;
    setReplyingTo({ id, preview, sender, nonce: replyNonceRef.current });
  }, []);
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** Id of the "Select"-tapped message — its body renders selectable for copy. */
  const [selectedForCopy, setSelectedForCopy] = useState<string | null>(null);
  /** On-screen rect of the tapped message row — anchors the action menu. */
  const [menuAnchor, setMenuAnchor] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  /** Topnav overflow (3-dot) menu open state. */
  const [overflowOpen, setOverflowOpen] = useState(false);
  /** Conversation metadata via TanStack Query — cached by convId (groupName:
   *  null = not resolved, '' = no name; isGroup gates the title→/group). */
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, groupDescription, isGroup } = useConvMeta(convId);
  /** Linked GitHub issue/PR URL (Linear-style). Seed from the channels cache,
   *  stay in sync, and refresh from synced appData on mount. */
  const cachedGithub = (cid?: string): string | undefined => {
    const v = getCachedRows()?.find(r => r.convId === cid)?.github;
    return typeof v === 'string' && v ? v : undefined;
  };
  const [github, setGithub] = useState<string | undefined>(() => cachedGithub(convId));
  useEffect(() => {
    const apply = (): void => setGithub(cachedGithub(convId));
    apply();
    const unsub = subscribeCachedRows(apply);
    let cancelled = false;
    if (isGroup) void getGithubLink(activeLine).then(v => { if (!cancelled) setGithub(v); }).catch(() => undefined);
    return () => { cancelled = true; unsub(); };
  }, [convId, activeLine, isGroup]);

  /** Group label chips for the intro header. Seed from cache, refresh on mount. */
  const cachedLabels = (cid?: string): string[] => {
    const v = getCachedRows()?.find(r => r.convId === cid)?.labels;
    return Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : [];
  };
  const [groupLabels, setGroupLabels] = useState<string[]>(() => cachedLabels(convId));
  useEffect(() => {
    if (!isGroup) { setGroupLabels([]); return; }
    setGroupLabels(cachedLabels(convId));
    let cancelled = false;
    void getGroupLabels(activeLine).then(v => { if (!cancelled) setGroupLabels(v); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [convId, activeLine, isGroup]);

  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return inboxToAddr[inboxId] ?? null;
  }, [inboxToAddr]);

  /** Resolve peer + member profiles → DM display name + avatar cache-busters. */
  const profilesVersion = usePeerProfiles([peerAddr, ...memberAddrs]);

  /** @-mention candidates for the composer popup — group members (sans self)
   *  or the lone DM peer, read from the resolved peerProfiles cache. */
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
  }, [isGroup, memberAddrs, peerAddr, profilesVersion]);

  /** Per-conversation scroll persistence. The list is INVERTED, so
   *  `contentOffset.y` is the distance scrolled UP from the newest message
   *  (0 = bottom). Restore once on first content layout if a saved offset
   *  exists; listEpoch remounts skip restore so they land at the bottom. */
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

  /** Poll message ids → option count — keeps vote-reactions out of emoji pills. */
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]);
  const ownReactions = useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]);
  /** Poll tallies — confirmed votes per poll + the local user's selections. */
  const votes = useMemo(() => votesByMessage(events), [events]);
  const ownVotes = useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]);

  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, reactions, ownReactions);
  const { displayVotes, displayOwnVotes, onVote } = useVotesLayer(activeLine, events, votes, ownVotes, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  /** Optimistic outbound + inverted-list scroll/jump layer. */
  const {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine);

  /** Inbound onAnswer (quick-reply button) — posts the label as a reply. */
  const onAnswer = useCallback((messageId: string, label: string) => {
    void xmtpReply(activeLine, messageId, label)
      .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
  }, [activeLine]);

  return {
    activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, status, myUri,
    showJump, setShowJump, listEpoch, setListEpoch,
    replyingTo, setReplyingTo, setReplyTarget, jumpHighlightId,
    menuFor, setMenuFor, menuAnchor, setMenuAnchor, overflowOpen, setOverflowOpen,
    selectedForCopy, setSelectedForCopy,
    confirmedIds, optimisticReactions, optimisticRemovals,
    peerAddr, groupName, groupImage, groupDescription, groupLabels, isGroup, github, senderEthOf,
    profilesVersion, mentionCandidates, listRef,
    savedScrollRef, savedScrollLoaded, didRestoreScroll,
    reactions, ownReactions, displayVotes, displayOwnVotes,
    allBubbles, jumpToMessage,
    onReact, onSign, signingIds, onVote, onPay, payingIds, onAnswer,
    onOptimistic, onSent,
  };
}
