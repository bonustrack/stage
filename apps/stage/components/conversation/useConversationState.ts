import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePeerProfiles, peerLabel } from '../../lib/peerProfiles';
import { inboxIdOfUri, lineOfConv, userUriOf } from '@stage-labs/client/xmtp/line';
import { useXmtpFeed } from '../../lib/feed/useXmtpFeed';
import { useChannelRoles, useConvDetails, useConvRow } from '../../lib/messaging/queries';
import { memberAddressesOf } from '../../lib/messaging/convRow.model';
import { markConvRead } from '../../lib/channelsCache';
import { isAppInFront, subscribeAppInFront } from '../../lib/appInFront';
import { useConvConsentState } from '../../lib/messaging/useConvConsent';
import { inboxEthAddresses } from '../../lib/xmtp.identity';
import { showConversation } from '../../lib/activeConversation';
import { isCoarsePointer } from '../layout/webLayout';
import { useReconciledMap } from '../../lib/mapReconcile';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isSystemEntry } from '@stage-labs/client/xmtp/entryPayload';
import { deletedMessages, type DeletedMessages } from '@stage-labs/client/xmtp/deletions';
import { superAdminInboxIds } from '@stage-labs/client/xmtp/groups';
import { useOwnDeletes } from '../../lib/ownDeletes';
import { useLiveChannelLabels } from '../channel/channel.labels';
import type { MenuAnchor } from '../bubble/model';
import { callRecordsOf } from '../bubble/callCard.model';
import type { MenuPoint } from '../AnchoredMenu.model';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { makeSeenCheck } from './markRead.model';
import { useFeedBubbles, useOutboundLayer } from './useOutboundLayer';
import { useFeedScroll } from './useFeedScroll';
import { useBubbleFeed } from './useBubbleFeed';
import { convKindOf } from './convKind.model';
import { useClearedChats } from '../../lib/sync/clearedChats';
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
      return showConversation(activeConvId);
    }, [activeConvId]),
  );
}

function useMarkReadWhileSeen(convId: string | undefined, fromOthers: number): void {
  useFocusEffect(
    useCallback(() => {
      if (!convId) return;
      const check = makeSeenCheck(isAppInFront, () => {
        void markConvRead(convId).catch(reported('chat.markRead'));
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
  const [replyingTo, setReplyingTo] = useState<{ id: string; sender?: string | null; nonce: number } | null>(null);
  const replyNonceRef = useRef(0);
  const setReplyTarget = useCallback((id: string, sender?: string | null) => {
    replyNonceRef.current += 1;
    setReplyingTo({ id, sender, nonce: replyNonceRef.current });
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
  const kind = convKindOf(row);
  const isGroup = kind === 'group';
  return {
    kind,
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
  const autoFocusNonce = useMemo(() => (focus || !isCoarsePointer() ? Date.now() : undefined), [focus, convId]);

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
  const myUri = userUriOf(xmtpFeed.inboxId);
  useMarkReadWhileSeen(convId, countFromOthers(events, myUri));
  useActiveConvSuppression(convId);
  const status = feedStatus(xmtpFeed.status);
  const feed = { activeLine, autoFocusNonce, events, loadOlder, hasMore, loadingOlder, retryFeed, status, myUri };
  return { feed, inboxId: xmtpFeed.inboxId, fields };
}

function useConvMenus(convId: string | undefined) {
  const reply = useReplyTarget();
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
    ...reply,
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
      const inboxId = inboxIdOfUri(from);
      return inboxId === '' ? null : (knownAddrs[inboxId] ?? null);
    },
    [knownAddrs],
  );

  const selfAddr = selfInboxId ? (inboxToAddr[selfInboxId] ?? null) : null;
  const profilesVersion = usePeerProfiles([peerAddr, selfAddr, ...memberAddrs]);
  const mentionCandidates = useMentionCandidates(isGroup, memberAddrs, peerAddr, profilesVersion);
  return { senderEthOf, profilesVersion, mentionCandidates };
}

function useConvSummary(convId: string | undefined, fields: ReturnType<typeof useConvFields>) {
  const { kind, isGroup, peerAddr, groupName, groupImage, groupDescription } = fields;
  const groupLabels = useLiveChannelLabels(convId);
  return { kind, isGroup, peerAddr, groupName, groupImage, groupDescription, groupLabels };
}

export type ConvSummary = ReturnType<typeof useConvSummary>;

export function useConversationState(convId: string | undefined, focus: string | undefined) {
  const { feed, inboxId, fields } = useConvFeed(convId, focus);
  const { activeLine, events, myUri } = feed;
  const { inboxToAddr, isGroup } = fields;
  const conv = useConvSummary(convId, fields);

  const menus = useConvMenus(convId);
  const { consent, consentKnown, markAllowed: markConsentAllowed } = useConsentGate(convId);
  const consentAllowed = consent === undefined ? undefined : consent === 'allowed';

  const people = useConvPeople(events, fields, inboxId);

  const { reactions, ownReactions, votes, ownVotes, openAnswers, callRecords } = useFeedDerivations(events, myUri, !isGroup);
  const { deletedIds, isSuperAdmin } = useFeedDeletions(events, isGroup ? convId : undefined, inboxToAddr, inboxId);

  const reactionsLayer = useReactionsLayer(activeLine, ownReactions);
  const votesLayer = useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const txSignLayer = useTxSignLayer(activeLine);
  const { confirmedIds, setOutbound, allBubbles, rowKeyOf } = useFeedBubbles(events, myUri, deletedIds);
  const scroll = useFeedScroll(convId, allBubbles, feed.loadOlder);
  const outbound = useOutboundLayer(setOutbound, myUri, convId, activeLine, scroll.followNewest);

  const bubbles = useBubbleFeed(
    {
      events,
      reactions,
      profilesVersion: people.profilesVersion,
      replyingTo: menus.replyingTo,
      menuFor: menus.menuFor,
      myUri,
      consentAllowed,
      senderEthOf: people.senderEthOf,
      deletedIds,
      confirmedIds,
      jumpHighlightId: scroll.jumpHighlightId,
      selectedForCopy: menus.selectedForCopy,
      optimisticReactions: reactionsLayer.optimisticReactions,
      optimisticRemovals: reactionsLayer.optimisticRemovals,
      ownReactions,
      votes: votesLayer.displayVotes,
      ownVotes: votesLayer.displayOwnVotes,
      openAnswers: votesLayer.displayOpenAnswers,
      callRecords,
      signingIds: txSignLayer.signingIds,
      payingIds: txSignLayer.payingIds,
    },
    {
      onReact: reactionsLayer.onReact,
      setReplyTarget: menus.setReplyTarget,
      setMenuAnchor: menus.setMenuAnchor,
      setMenuFor: menus.setMenuFor,
      jumpToMessage: scroll.jumpToMessage,
      onVote: votesLayer.onVote,
      onOpenAnswer: votesLayer.onOpenAnswer,
      onSign: txSignLayer.onSign,
      onPay: txSignLayer.onPay,
      setSelectedForCopy: menus.setSelectedForCopy,
    },
  );

  return {
    conv,
    feed: {
      line: activeLine,
      status: feed.status,
      hasMore: feed.hasMore,
      loadingOlder: feed.loadingOlder,
      retryFeed: feed.retryFeed,
      bubbles: allBubbles,
      rowKeyOf,
      scroll,
    },
    bubbles,
    composer: {
      line: activeLine,
      autoFocusNonce: feed.autoFocusNonce,
      mentionCandidates: people.mentionCandidates,
      replyingTo: menus.replyingTo,
      setReplyingTo: menus.setReplyingTo,
      onOptimistic: outbound.onOptimistic,
      onSent: outbound.onSent,
      consent,
      consentKnown,
      markConsentAllowed,
    },
    overflow: {
      open: menus.overflowOpen,
      setOpen: menus.setOverflowOpen,
      anchor: menus.overflowAnchor,
      setAnchor: menus.setOverflowAnchor,
    },
    messageMenu: {
      target: menus.menuFor,
      setTarget: menus.setMenuFor,
      anchor: menus.menuAnchor,
      onReact: reactionsLayer.onReact,
      setReplyTarget: menus.setReplyTarget,
      senderEthOf: people.senderEthOf,
      setSelectedForCopy: menus.setSelectedForCopy,
      myUri,
      deletedIds,
      isSuperAdmin,
    },
  };
}

type ConversationState = ReturnType<typeof useConversationState>;
export type FeedSlice = ConversationState['feed'];
export type ComposerSlice = ConversationState['composer'];
export type OverflowSlice = ConversationState['overflow'];
export type MessageMenuSlice = ConversationState['messageMenu'];
