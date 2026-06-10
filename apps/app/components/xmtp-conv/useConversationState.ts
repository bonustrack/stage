/** State + side-effects + action wiring for the XMTP conversation screen — the
 *  route owns only the render tree; reaction/vote/tx-sign layers are own hooks. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { useConvMeta } from '../../lib/useConvMeta';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReply, shortAddress,
} from '../../modules/messaging';
import { setActiveConversation } from '../../modules/metro-pill';
import { setActiveConvId } from '../../lib/activeConv';
import { markConvRead, getCachedRows } from '../../modules/messaging';
import { getGithubLink } from '../../modules/messaging';
import { useCachedGroupString } from './useCachedGroupString';
import { getGroupLabels } from '../../modules/messaging';
import { convScrollKey, getScrollOffset, flushScrollOffset, markConvAtBottom } from '../../lib/scrollPos';
import type { HistoryEntry } from '../../lib/types';
import {
  reactionsByMessage, ownReactionsByMessage,
  pollOptionCountsInFeed, votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from './feed-helpers';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { useOutboundLayer } from './useOutboundLayer';

export function useConversationState(convId: string | undefined, focus: string | undefined) {
  const activeLine = lineOfConv(convId ?? '');
  const autoFocusNonce = useMemo(() => (focus ? Date.now() : undefined), [focus]);

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  const { loadOlder, hasMore, loadingOlder } = xmtpFeed;
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId); // mark read when the latest event count changes
  }, [convId, events.length]);
  /** Tell native + JS which conversation is on-screen so FCM + foreground rich-notif
   *  paths suppress it. Lowercase: the native FCM compare is case-sensitive. */
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
    return () => { sub.remove(); setActiveConversation(null); setActiveConvId(null); };
  }, [activeConvId]));
  const status: 'idle' | 'connecting' | 'open' | 'error' = xmtpFeed.status === 'open' ? 'open'
    : xmtpFeed.status === 'loading' ? 'connecting'
      : xmtpFeed.status === 'error' ? 'error' : 'idle';
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  /** `nonce` bumps every reply so the composer's focus effect re-fires (monotonic). */
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string; sender?: string | null; nonce: number } | null>(null);
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
  /** Synced-appData string field (github link). Seeds from the cached row, then
   *  refreshes off the group's appData on mount; drives the topnav GitHub icon. */
  const github = useCachedGroupString(convId, activeLine, isGroup, 'github', getGithubLink);

  /** Group label chips for the intro header — seed from cache, refresh on mount. */
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

  /** Our own eth address (via the inbox→addr map), so our OWN message bubbles +
   *  reply previews resolve our stamp name/avatar — a DM's memberAddrs is empty,
   *  so without this self is never fetched and renders blank. */
  const selfAddr = xmtpFeed.inboxId ? (inboxToAddr[xmtpFeed.inboxId] ?? null) : null;

  /** Resolve peer + member + self profiles → display names + avatar cache-busters. */
  const profilesVersion = usePeerProfiles([peerAddr, selfAddr, ...memberAddrs]);

  /** @-mention candidates for the composer popup — group members (sans self) or
   *  the lone DM peer, from the resolved peerProfiles cache. */
  const mentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const out: { address: string; name: string }[] = [];
    const add = (addr: string | null): void => {
      if (!addr) return;
      const k = addr.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({
        address: addr,
        name: getPeerName(addr) ?? shortAddress(addr),
      });
    };
    if (isGroup) memberAddrs.forEach(add);
    else add(peerAddr);
    return out;
  }, [isGroup, memberAddrs, peerAddr, profilesVersion]);

  /** Per-conversation scroll persistence. INVERTED list → offset 0 = bottom/newest.
   *  Restore once on first layout if a saved offset exists; remounts land at bottom. */
  const savedScrollRef = useRef<number | undefined>(undefined);
  const savedScrollLoaded = useRef(false);
  const didRestoreScroll = useRef(false);
  /** Deadline (ms epoch) the at-bottom mount keeps re-pinning to 0; 0 = unarmed. */
  const pinBottomUntil = useRef(0);
  /** At-bottom flag, set on EVERY scroll (and by markAtBottom). The debounced save
   *  can lose its final at-bottom frame to a fast back-nav; this ref can't, so on
   *  unmount we force-persist sentinel 0 when true. Defaults true (fresh = bottom). */
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    if (!convId) return;
    const key = convScrollKey(convId);
    isAtBottomRef.current = true;
    void getScrollOffset(key).then(o => {
      savedScrollRef.current = o; savedScrollLoaded.current = true;
    });
    // At bottom on leave → force-persist the sentinel; else flush the pending offset.
    return () => { flushScrollOffset(key, isAtBottomRef.current ? 0 : undefined); };
  }, [convId]);

  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]);
  const ownReactions = useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]);
  const votes = useMemo(() => votesByMessage(events), [events]);
  const ownVotes = useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]);
  const openAnswers = useMemo(() => openAnswersByMessage(events), [events]);

  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, reactions, ownReactions);
  const { displayVotes, displayOwnVotes, onVote, displayOpenAnswers, onOpenAnswer } =
    useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  /** Optimistic outbound + inverted-list scroll/jump layer. */
  const {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine);

  /** Jump-to-bottom pressed → list remounts to offset 0 (newest) but may not emit
   *  an onScroll, so flag at-bottom + persist sentinel 0 now to survive leave. */
  const markAtBottom = useCallback(() => {
    isAtBottomRef.current = true;
    if (convId) markConvAtBottom(convId);
  }, [convId]);
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
    savedScrollRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef,
    reactions, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers,
    allBubbles, jumpToMessage,
    onReact, onSign, signingIds, onVote, onOpenAnswer, onPay, payingIds, onAnswer,
    onOptimistic, onSent, markAtBottom,
  };
}
