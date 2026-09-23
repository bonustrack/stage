import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReply, shortAddress, useConvMeta, markConvRead,
  getCachedRows, getGroupLabels, useConvConsentState,
} from '../../modules/messaging';
import { setActiveConversation } from '../../modules/stage-pill';
import { setActiveConvId } from '../../lib/readSyncRegistry';
import {
  markConvAtBottom, convScrollKey, getScrollOffset, peekScrollOffset, flushScrollOffset, getFeedAnchor, peekFeedAnchor,
  type FeedAnchor,
} from '../../lib/scrollPos';
import { isCoarsePointer } from '../../lib/webLayout';
import { useReconciledMap } from '../../lib/mapReconcile';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isSystemEntry } from '@stage-labs/client/xmtp/envelope';
import type { MenuAnchor } from '../bubble/props';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { useOutboundLayer } from './useOutboundLayer';
import { useClearedChats } from '../../lib/clearedChats';
import {
  entriesAfterClear, feedReachedClear, reactionsByMessage, ownReactionsByMessage,
  pollOptionCountsInFeed, votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from './feed-helpers';
import { reported } from '../../lib/errorPolicy';

function useActiveConvSuppression(convId: string | undefined): void {
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
}

type ConvConsent = Exclude<ReturnType<typeof useConvConsentState>, null>;

interface ConsentGate {
  consent: ConvConsent;
  markAllowed: () => void;
}

function useConsentGate(convId: string | undefined): ConsentGate {
  const streamed = useConvConsentState(convId);
  const [allowedHere, setAllowedHere] = useState(false);
  useEffect(() => { setAllowedHere(false); }, [convId, streamed]);
  const markAllowed = useCallback(() => { setAllowedHere(true); }, []);
  return { consent: allowedHere ? 'allowed' : streamed ?? undefined, markAllowed };
}

function cachedLabels(cid?: string): string[] {
  const v = getCachedRows()?.find(r => r.convId === cid)?.labels;
  return Array.isArray(v) ? v.filter((l): l is string => typeof l === 'string') : [];
}

function useGroupLabels(convId: string | undefined, activeLine: string, isGroup: boolean): string[] {
  const [groupLabels, setGroupLabels] = useState<string[]>(() => cachedLabels(convId));
  useEffect(() => {
    if (!isGroup) { setGroupLabels([]); return; }
    setGroupLabels(cachedLabels(convId));
    let cancelled = false;
    void getGroupLabels(activeLine).then(v => { if (!cancelled) setGroupLabels(v); }).catch(reported('conversation.labels'));
    return () => { cancelled = true; };
  }, [convId, activeLine, isGroup]);
  return groupLabels;
}

interface ScrollPersistence {
  savedScrollRef: React.MutableRefObject<number | undefined>;
  savedAnchorRef: React.MutableRefObject<FeedAnchor | null>;
  savedScrollLoaded: React.MutableRefObject<boolean>;
  didRestoreScroll: React.MutableRefObject<boolean>;
  pinBottomUntil: React.MutableRefObject<number>;
  isAtBottomRef: React.MutableRefObject<boolean>;
}

function useConvScrollPersistence(convId: string | undefined): ScrollPersistence {
  const savedScrollRef = useRef<number | undefined>(undefined);
  const savedAnchorRef = useRef<FeedAnchor | null>(null);
  const savedScrollLoaded = useRef(false);
  const didRestoreScroll = useRef(false);
  const pinBottomUntil = useRef(0);
  const isAtBottomRef = useRef(true);
  useLayoutEffect(() => {
    if (!convId) return;
    const key = convScrollKey(convId);
    isAtBottomRef.current = true;
    didRestoreScroll.current = false;
    pinBottomUntil.current = 0;
    const cached = peekScrollOffset(key);
    const cachedAnchor = peekFeedAnchor(convId);
    if (cached !== undefined && cachedAnchor !== undefined) {
      savedScrollRef.current = cached;
      savedAnchorRef.current = cachedAnchor;
      savedScrollLoaded.current = true;
    } else {
      void Promise.all([getScrollOffset(key), getFeedAnchor(convId)]).then(([o, anchor]) => {
        savedScrollRef.current = o; savedAnchorRef.current = anchor; savedScrollLoaded.current = true;
      });
    }
    return () => { flushScrollOffset(key); };
  }, [convId]);
  return { savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef };
}

function useFeedDerivations(events: HistoryEntry[], myUri: string) {
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useReconciledMap(useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]));
  const ownReactions = useReconciledMap(useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]));
  const votes = useReconciledMap(useMemo(() => votesByMessage(events), [events]));
  const ownVotes = useReconciledMap(useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]));
  const openAnswers = useReconciledMap(useMemo(() => openAnswersByMessage(events), [events]));
  return { reactions, ownReactions, votes, ownVotes, openAnswers };
}

function useReplyTarget() {
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string; sender?: string | null; nonce: number } | null>(null);
  const replyNonceRef = useRef(0);
  const setReplyTarget = useCallback((id: string, preview: string, sender?: string | null) => {
    replyNonceRef.current += 1;
    setReplyingTo({ id, preview, sender, nonce: replyNonceRef.current });
  }, []);
  return { replyingTo, setReplyingTo, setReplyTarget };
}

function feedStatus(s: string): 'idle' | 'connecting' | 'open' | 'error' {
  if (s === 'open') return 'open';
  if (s === 'loading') return 'connecting';
  if (s === 'error') return 'error';
  return 'idle';
}

function useMentionCandidates(isGroup: boolean, memberAddrs: string[], peerAddr: string | null, profilesVersion: number) {
  return useMemo(() => {
    const seen = new Set<string>();
    const out: { address: string; name: string }[] = [];
    const add = (addr: string | null): void => {
      if (!addr) return;
      const k = addr.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ address: addr, name: getPeerName(addr) ?? shortAddress(addr) });
    };
    if (isGroup) memberAddrs.forEach(add); else add(peerAddr);
    return out;
  }, [isGroup, memberAddrs, peerAddr, profilesVersion]);
}

export function useConversationState(convId: string | undefined, focus: string | undefined) {
  const activeLine = lineOfConv(convId ?? '');
  const autoFocusNonce = useMemo(
    () => (focus || (Platform.OS === 'web' && !isCoarsePointer()) ? Date.now() : undefined),
    [focus, convId],
  );

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, groupDescription, isGroup } = useConvMeta(convId);
  const clearedAt = useClearedChats()[peerAddr?.toLowerCase() ?? ''];
  const events = useMemo(
    () => (peerAddr === null ? xmtpFeed.events : entriesAfterClear(xmtpFeed.events.filter(e => !isSystemEntry(e)), clearedAt)),
    [xmtpFeed.events, peerAddr, clearedAt],
  );
  const { loadOlder, loadingOlder } = xmtpFeed;
  const hasMore = xmtpFeed.hasMore && !feedReachedClear(xmtpFeed.events, clearedAt);
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId);
  }, [convId, events.length]);
  useActiveConvSuppression(convId);
  const status = feedStatus(xmtpFeed.status);
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  const { replyingTo, setReplyingTo, setReplyTarget } = useReplyTarget();
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  const [selectedForCopy, setSelectedForCopy] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>({ y: 0, height: 0 });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<MenuPoint | null>(null);
  const { consent, markAllowed: markConsentAllowed } = useConsentGate(convId);
  const consentAllowed = consent === undefined ? undefined : consent === 'allowed';
  const groupLabels = useGroupLabels(convId, activeLine, isGroup);

  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return inboxToAddr[inboxId] ?? null;
  }, [inboxToAddr]);

  const selfAddr = xmtpFeed.inboxId ? (inboxToAddr[xmtpFeed.inboxId] ?? null) : null;
  const profilesVersion = usePeerProfiles([peerAddr, selfAddr, ...memberAddrs]);
  const mentionCandidates = useMentionCandidates(isGroup, memberAddrs, peerAddr, profilesVersion);

  const scroll = useConvScrollPersistence(convId);
  const { savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef } = scroll;

  const atBottom = useCallback(() => isAtBottomRef.current, [isAtBottomRef]);
  const { reactions, ownReactions, votes, ownVotes, openAnswers } = useFeedDerivations(events, myUri);

  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, reactions, ownReactions);
  const { displayVotes, displayOwnVotes, onVote, displayOpenAnswers, onOpenAnswer } =
    useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  const {
    showJump, setShowJump, scrollToNewest, jumpHighlightId,
    listRef, confirmedIds, allBubbles, rowKeyOf, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine, atBottom);

  const markAtBottom = useCallback(() => {
    isAtBottomRef.current = true;
    if (convId) markConvAtBottom(convId);
  }, [convId]);
  const onAnswer = useCallback((messageId: string, label: string) => {
    void xmtpReply(activeLine, messageId, label)
      .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
  }, [activeLine]);

  return {
    activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, status, myUri,
    showJump, setShowJump, scrollToNewest,
    replyingTo, setReplyingTo, setReplyTarget, jumpHighlightId,
    menuFor, setMenuFor, menuAnchor, setMenuAnchor, overflowOpen, setOverflowOpen,
    overflowAnchor, setOverflowAnchor,
    selectedForCopy, setSelectedForCopy,
    confirmedIds, optimisticReactions, optimisticRemovals,
    peerAddr, groupName, groupImage, groupDescription, groupLabels, isGroup, senderEthOf,
    profilesVersion, mentionCandidates, listRef,
    savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef,
    reactions, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers,
    allBubbles, rowKeyOf, jumpToMessage,
    onReact, onSign, signingIds, onVote, onOpenAnswer, onPay, payingIds, onAnswer,
    onOptimistic, onSent, markAtBottom, consent, consentAllowed, markConsentAllowed,
  };
}
