import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { XMTP_USER_PREFIX, lineOfConv } from '@stage-labs/client/xmtp/line';
import { useXmtpFeed } from '../../lib/xmtp.feed';
import { xmtpReply } from '../../lib/xmtp.messages';
import { useConvDetails, useConvRow } from '../../modules/messaging/queries';
import { isGroupRow, memberAddressesOf } from '../../modules/messaging/convRow.model';
import { markConvRead } from '../../lib/channelsCache';
import { isAppInFront, subscribeAppInFront } from '../../lib/appInFront';
import { useConvConsentState } from '../../modules/messaging/useConvConsent';
import { inboxEthAddresses } from '../../lib/xmtp.identity';
import { setActiveConversation } from '../../modules/stage-pill';
import { setActiveConvId } from '../../lib/xmtp.state.core';
import {
  markConvAtBottom,
  convScrollKey,
  getScrollOffset,
  peekScrollOffset,
  flushScrollOffset,
  getFeedAnchor,
  peekFeedAnchor,
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
import { makeSeenCheck } from './markRead.model';
import { useOutboundLayer } from './useOutboundLayer';
import { useClearedChats } from '../../lib/clearedChats';
import { entriesAfterClear, feedReachedClear, countFromOthers } from './feed-helpers';
import { ownReactionsByMessage, reactionsByMessage } from '@stage-labs/client/xmtp/reactions';
import { pollOptionCountsInFeed, votesByMessage, ownVotesByMessage, openAnswersByMessage } from '@stage-labs/client/xmtp/poll-feed';
import { reported } from '../../lib/errorPolicy';
import { unknownSystemLineInboxIds } from './systemNames.model';
import { uniqueBy } from '@stage-labs/client/collections';

function useSystemLineAddresses(events: HistoryEntry[], inboxToAddr: Record<string, string>): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const missingKey = useMemo(() => unknownSystemLineInboxIds(events, inboxToAddr).join(','), [events, inboxToAddr]);
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    void inboxEthAddresses(missingKey.split(','))
      .then((found) => {
        if (!cancelled && Object.keys(found).length > 0) setResolved((prev) => ({ ...prev, ...found }));
      })
      .catch(reported('conversation.systemLineAddresses'));
    return () => {
      cancelled = true;
    };
  }, [missingKey]);
  return useMemo(() => ({ ...resolved, ...inboxToAddr }), [resolved, inboxToAddr]);
}

function useActiveConvSuppression(convId: string | undefined): void {
  const activeConvId = useMemo(() => convId?.toLowerCase(), [convId]);
  useFocusEffect(
    useCallback(() => {
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
    }, [activeConvId]),
  );
}

function useMarkReadWhileSeen(convId: string | undefined, fromOthers: number): void {
  useFocusEffect(
    useCallback(() => {
      if (!convId) return;
      const check = makeSeenCheck(isAppInFront, () => {
        void markConvRead(convId);
      });
      check();
      return subscribeAppInFront(check);
    }, [convId, fromOthers]),
  );
}

function useFeedDeletions(
  events: HistoryEntry[],
  groupId: string | undefined,
  inboxToAddr: Record<string, string>,
  selfInboxId: string,
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

function useConsentGate(convId: string | undefined) {
  const streamed = useConvConsentState(convId);
  const [allowedHere, setAllowedHere] = useState(false);
  useEffect(() => {
    setAllowedHere(false);
  }, [convId, streamed]);
  const markAllowed = useCallback(() => {
    setAllowedHere(true);
  }, []);
  return { consent: allowedHere ? 'allowed' : (streamed ?? undefined), consentKnown: allowedHere || streamed !== undefined, markAllowed };
}

function useConvScrollPersistence(convId: string | undefined) {
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
        savedScrollRef.current = o;
        savedAnchorRef.current = anchor;
        savedScrollLoaded.current = true;
      });
    }
    return () => {
      flushScrollOffset(key);
    };
  }, [convId]);
  return { savedScrollRef, savedAnchorRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef };
}

function useFeedDerivations(events: HistoryEntry[], myUri: string, dm: boolean) {
  const pollOptionCounts = useMemo(() => pollOptionCountsInFeed(events), [events]);
  const reactions = useReconciledMap(useMemo(() => reactionsByMessage(events, pollOptionCounts), [events, pollOptionCounts]));
  const ownReactions = useReconciledMap(
    useMemo(() => ownReactionsByMessage(events, myUri, pollOptionCounts), [events, myUri, pollOptionCounts]),
  );
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

const NO_MAP: Record<string, string> = {};

function useConvFields(convId: string | undefined) {
  const row = useConvRow(convId);
  const { description } = useConvDetails(convId, row);
  const memberAddrs = useMemo(() => memberAddressesOf(row), [row]);
  const isGroup = isGroupRow(row);
  return {
    peerAddr: row?.peerAddress ?? null,
    memberAddrs,
    inboxToAddr: row?.inboxToAddr ?? NO_MAP,
    isGroup,
    groupName: isGroup ? (row?.groupName ?? null) : null,
    groupImage: row?.avatarUri ?? '',
    groupDescription: description,
  };
}

function useMentionCandidates(isGroup: boolean, memberAddrs: string[], peerAddr: string | null, profilesVersion: number) {
  return useMemo(() => {
    const addrs = (isGroup ? memberAddrs : [peerAddr]).filter((a): a is string => !!a);
    return uniqueBy(addrs, (a) => a.toLowerCase()).map((address) => ({ address, name: peerLabel(address) }));
  }, [isGroup, memberAddrs, peerAddr, profilesVersion]);
}

function useConvFeed(convId: string | undefined, focus: string | undefined) {
  const activeLine = lineOfConv(convId ?? '');
  const autoFocusNonce = useMemo(() => (focus || (Platform.OS === 'web' && !isCoarsePointer()) ? Date.now() : undefined), [focus, convId]);

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const fields = useConvFields(convId);
  const { peerAddr } = fields;
  const clearedAt = useClearedChats()[peerAddr?.toLowerCase() ?? ''];
  const events = useMemo(
    () =>
      peerAddr === null
        ? xmtpFeed.events
        : entriesAfterClear(
            xmtpFeed.events.filter((e) => !isSystemEntry(e)),
            clearedAt,
          ),
    [xmtpFeed.events, peerAddr, clearedAt],
  );
  const { loadOlder, loadingOlder, retry: retryFeed } = xmtpFeed;
  const hasMore = xmtpFeed.hasMore && !feedReachedClear(xmtpFeed.events, clearedAt);
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;
  useMarkReadWhileSeen(convId, countFromOthers(events, myUri));
  useActiveConvSuppression(convId);
  const status = feedStatus(xmtpFeed.status);
  const feed = { activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, retryFeed, status, myUri };
  return { feed, inboxId: xmtpFeed.inboxId, fields };
}

function useConvMenus(convId: string | undefined) {
  const { replyingTo, setReplyingTo, setReplyTarget } = useReplyTarget();
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  const [selectedForCopy, setSelectedForCopy] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setSelectedForCopy(null);
      return () => {
        setSelectedForCopy(null);
      };
    }, [convId]),
  );
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor>({ y: 0, height: 0 });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowAnchor, setOverflowAnchor] = useState<MenuPoint | null>(null);
  return {
    replyingTo,
    setReplyingTo,
    setReplyTarget,
    menuFor,
    setMenuFor,
    menuAnchor,
    setMenuAnchor,
    overflowOpen,
    setOverflowOpen,
    overflowAnchor,
    setOverflowAnchor,
    selectedForCopy,
    setSelectedForCopy,
  };
}

function useConvPeople(events: HistoryEntry[], fields: ReturnType<typeof useConvFields>, selfInboxId: string) {
  const { peerAddr, memberAddrs, inboxToAddr, isGroup } = fields;
  const knownAddrs = useSystemLineAddresses(events, inboxToAddr);
  const senderEthOf = useCallback(
    (from: string): string | null => {
      if (!from.startsWith(XMTP_USER_PREFIX)) return null;
      const inboxId = from.slice(XMTP_USER_PREFIX.length);
      return knownAddrs[inboxId] ?? null;
    },
    [knownAddrs],
  );

  const selfAddr = selfInboxId ? (inboxToAddr[selfInboxId] ?? null) : null;
  const profilesVersion = usePeerProfiles([peerAddr, selfAddr, ...memberAddrs]);
  const mentionCandidates = useMentionCandidates(isGroup, memberAddrs, peerAddr, profilesVersion);
  return { senderEthOf, profilesVersion, mentionCandidates };
}

export function useConversationState(convId: string | undefined, focus: string | undefined) {
  const { feed, inboxId, fields } = useConvFeed(convId, focus);
  const { activeLine, events, myUri } = feed;
  const { peerAddr, inboxToAddr, groupName, groupImage, groupDescription, isGroup } = fields;

  const menus = useConvMenus(convId);
  const { consent, consentKnown, markAllowed: markConsentAllowed } = useConsentGate(convId);
  const consentAllowed = consent === undefined ? undefined : consent === 'allowed';
  const groupLabels = useLiveChannelLabels(convId);

  const people = useConvPeople(events, fields, inboxId);

  const scroll = useConvScrollPersistence(convId);
  const { isAtBottomRef } = scroll;

  const { reactions, ownReactions, votes, ownVotes, openAnswers, callRecords } = useFeedDerivations(events, myUri, !isGroup);
  const { deletedIds, isSuperAdmin } = useFeedDeletions(events, isGroup ? convId : undefined, inboxToAddr, inboxId);

  const reactionsLayer = useReactionsLayer(activeLine, ownReactions);
  const votesLayer = useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const txSignLayer = useTxSignLayer(activeLine);
  const outbound = useOutboundLayer(events, myUri, convId, activeLine, isAtBottomRef, deletedIds);

  const markAtBottom = useCallback(() => {
    isAtBottomRef.current = true;
    if (convId) markConvAtBottom(convId);
  }, [convId]);
  const onAnswer = useCallback(
    (messageId: string, label: string) => {
      void xmtpReply(activeLine, messageId, label).catch((e: unknown) => {
        console.warn('xmtp answer failed', e);
      });
    },
    [activeLine],
  );

  return {
    ...feed,
    ...menus,
    ...outbound,
    ...reactionsLayer,
    ...votesLayer,
    ...txSignLayer,
    ...people,
    ...scroll,
    peerAddr,
    groupName,
    groupImage,
    groupDescription,
    groupLabels,
    isGroup,
    reactions,
    ownReactions,
    callRecords,
    deletedIds,
    isSuperAdmin,
    onAnswer,
    markAtBottom,
    consent,
    consentKnown,
    consentAllowed,
    markConsentAllowed,
  };
}
