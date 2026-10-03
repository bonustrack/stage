import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { XMTP_USER_PREFIX, lineOfConv } from '@stage-labs/client/xmtp/line';
import { useXmtpFeed } from '../../lib/xmtp.feed';
import { xmtpReply } from '../../lib/xmtp.messages';
import { useConvMeta } from '../../modules/messaging/queries';
import { markConvRead } from '../../lib/channelsCache';
import { useConvConsentState } from '../../modules/messaging/useConvConsent';
import { inboxEthAddresses } from '../../lib/xmtp.identity';
import { setActiveConversation } from '../../modules/stage-pill';
import { setActiveConvId } from '../../lib/xmtp.state.core';
import {
  markConvAtBottom, convScrollKey, getScrollOffset, peekScrollOffset, flushScrollOffset, getFeedAnchor, peekFeedAnchor,
  type FeedAnchor,
} from '../../lib/scrollPos';
import { isCoarsePointer } from '../../lib/webLayout';
import { useReconciledMap } from '../../lib/mapReconcile';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isSystemEntry } from '@stage-labs/client/xmtp/envelope';
import { deletedMessages, type DeletedMessages } from '@stage-labs/client/xmtp/deletions';
import { superAdminInboxIds } from '@stage-labs/client/xmtp/groups';
import { useOwnDeletes } from '../../lib/ownDeletes';
import { useChannelRoles } from '../channel/channel.detail';
import { useLiveChannelLabels } from '../channel/channel.labels';
import type { MenuAnchor } from '../bubble/props';
import { callRecordsOf } from '../bubble/callCard.model';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { useOutboundLayer } from './useOutboundLayer';
import { useClearedChats } from '../../lib/clearedChats';
import {
  entriesAfterClear, feedReachedClear, countFromOthers, reactionsByMessage, ownReactionsByMessage,
  pollOptionCountsInFeed, votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from './feed-helpers';
import { reported } from '../../lib/errorPolicy';
import { unknownSystemLineInboxIds } from './systemNames.model';
import { peerLabel } from './convTitle';
import { uniqueBy } from '@stage-labs/client/collections';

function useSystemLineAddresses(
  events: HistoryEntry[], inboxToAddr: Record<string, string>,
): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const missingKey = useMemo(() => unknownSystemLineInboxIds(events, inboxToAddr).join(','), [events, inboxToAddr]);
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    void inboxEthAddresses(missingKey.split(',')).then((found) => {
      if (!cancelled && Object.keys(found).length > 0) setResolved(prev => ({ ...prev, ...found }));
    }).catch(reported('conversation.systemLineAddresses'));
    return () => { cancelled = true; };
  }, [missingKey]);
  return useMemo(() => ({ ...resolved, ...inboxToAddr }), [resolved, inboxToAddr]);
}

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

function useFeedDeletions(
  events: HistoryEntry[], groupId: string | undefined, inboxToAddr: Record<string, string>, selfInboxId: string,
): { deletedIds: DeletedMessages; isSuperAdmin: boolean } {
  const ownDeletes = useOwnDeletes();
  const roles = useChannelRoles(groupId, inboxToAddr);
  const superAdminKey = [...superAdminInboxIds(inboxToAddr, roles)].sort().join(',');
  const superAdmins = useMemo(() => new Set(superAdminKey ? superAdminKey.split(',') : []), [superAdminKey]);
  const deletedIds = useMemo(
    () => deletedMessages(events, { ownDeletes, superAdmins, selfInboxId }),
    [events, ownDeletes, superAdmins, selfInboxId],
  );
  const isSuperAdmin = groupId !== undefined && selfInboxId !== '' && superAdmins.has(selfInboxId.toLowerCase());
  return { deletedIds, isSuperAdmin };
}

type ConvConsent = Exclude<ReturnType<typeof useConvConsentState>, null>;

interface ConsentGate {
  consent: ConvConsent;
  consentKnown: boolean;
  markAllowed: () => void;
}

function useConsentGate(convId: string | undefined): ConsentGate {
  const streamed = useConvConsentState(convId);
  const [allowedHere, setAllowedHere] = useState(false);
  useEffect(() => { setAllowedHere(false); }, [convId, streamed]);
  const markAllowed = useCallback(() => { setAllowedHere(true); }, []);
  return {
    consent: allowedHere ? 'allowed' : streamed ?? undefined,
    consentKnown: allowedHere || streamed !== undefined,
    markAllowed,
  };
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

function useFeedDerivations(events: HistoryEntry[], myUri: string, dm: boolean) {
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useReconciledMap(useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]));
  const ownReactions = useReconciledMap(useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]));
  const votes = useReconciledMap(useMemo(() => votesByMessage(events), [events]));
  const ownVotes = useReconciledMap(useMemo(() => ownVotesByMessage(events, myUri), [events, myUri]));
  const openAnswers = useReconciledMap(useMemo(() => openAnswersByMessage(events), [events]));
  const callRecords = useReconciledMap(useMemo(() => callRecordsOf(events, dm, myUri), [events, dm, myUri]));
  return { reactions, ownReactions, votes, ownVotes, openAnswers, callRecords };
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
    const addrs = (isGroup ? memberAddrs : [peerAddr]).filter((a): a is string => !!a);
    return uniqueBy(addrs, a => a.toLowerCase()).map(address => ({ address, name: peerLabel(address) }));
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
  const { loadOlder, loadingOlder, retry: retryFeed } = xmtpFeed;
  const hasMore = xmtpFeed.hasMore && !feedReachedClear(xmtpFeed.events, clearedAt);
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;
  const fromOthers = countFromOthers(events, myUri);
  useEffect(() => {
    if (!convId) return;
    void markConvRead(convId);
  }, [convId, fromOthers]);
  useActiveConvSuppression(convId);
  const status = feedStatus(xmtpFeed.status);

  const { replyingTo, setReplyingTo, setReplyTarget } = useReplyTarget();
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  const [selectedForCopy, setSelectedForCopy] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>({ y: 0, height: 0 });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<MenuPoint | null>(null);
  const { consent, consentKnown, markAllowed: markConsentAllowed } = useConsentGate(convId);
  const consentAllowed = consent === undefined ? undefined : consent === 'allowed';
  const groupLabels = useLiveChannelLabels(convId);

  const knownAddrs = useSystemLineAddresses(events, inboxToAddr);
  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return knownAddrs[inboxId] ?? null;
  }, [knownAddrs]);

  const selfAddr = xmtpFeed.inboxId ? (inboxToAddr[xmtpFeed.inboxId] ?? null) : null;
  const profilesVersion = usePeerProfiles([peerAddr, selfAddr, ...memberAddrs]);
  const mentionCandidates = useMentionCandidates(isGroup, memberAddrs, peerAddr, profilesVersion);

  const scroll = useConvScrollPersistence(convId);
  const { savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef } = scroll;

  const { reactions, ownReactions, votes, ownVotes, openAnswers, callRecords } = useFeedDerivations(events, myUri, !isGroup);
  const { deletedIds, isSuperAdmin } = useFeedDeletions(events, isGroup ? convId : undefined, inboxToAddr, xmtpFeed.inboxId);

  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, ownReactions);
  const { displayVotes, displayOwnVotes, onVote, displayOpenAnswers, onOpenAnswer } =
    useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  const {
    showJump, setShowJump, scrollToNewest, jumpHighlightId,
    listRef, confirmedIds, allBubbles, rowKeyOf, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine, isAtBottomRef, deletedIds);

  const markAtBottom = useCallback(() => {
    isAtBottomRef.current = true;
    if (convId) markConvAtBottom(convId);
  }, [convId]);
  const onAnswer = useCallback((messageId: string, label: string) => {
    void xmtpReply(activeLine, messageId, label)
      .catch((e: unknown) => { console.warn('xmtp answer failed', e); });
  }, [activeLine]);

  return {
    activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, retryFeed, status, myUri,
    showJump, setShowJump, scrollToNewest,
    replyingTo, setReplyingTo, setReplyTarget, jumpHighlightId,
    menuFor, setMenuFor, menuAnchor, setMenuAnchor, overflowOpen, setOverflowOpen,
    overflowAnchor, setOverflowAnchor,
    selectedForCopy, setSelectedForCopy,
    confirmedIds, optimisticReactions, optimisticRemovals,
    peerAddr, groupName, groupImage, groupDescription, groupLabels, isGroup, senderEthOf,
    profilesVersion, mentionCandidates, listRef,
    savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef,
    reactions, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, callRecords, deletedIds, isSuperAdmin,
    allBubbles, rowKeyOf, jumpToMessage,
    onReact, onSign, signingIds, onVote, onOpenAnswer, onPay, payingIds, onAnswer,
    onOptimistic, onSent, markAtBottom, consent, consentKnown, consentAllowed, markConsentAllowed,
  };
}
