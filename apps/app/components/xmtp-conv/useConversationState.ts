
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { useConvMeta } from '../../modules/messaging';
import {
  XMTP_USER_PREFIX, lineOfConv, useXmtpFeed, xmtpReply, shortAddress,
} from '../../modules/messaging';
import { markConvRead } from '../../modules/messaging';
import { getGithubLink } from '../../modules/messaging';
import { useCachedGroupString } from './useCachedGroupString';
import { markConvAtBottom } from '../../lib/scrollPos';
import type { HistoryEntry } from '../../lib/types';
import { useReactionsLayer } from './useReactionsLayer';
import { useVotesLayer } from './useVotesLayer';
import { useTxSignLayer } from './useTxSignLayer';
import { useOutboundLayer } from './useOutboundLayer';
import {
  useActiveConvSuppression, useConsentGate, useGroupLabels,
  useConvScrollPersistence, useFeedDerivations,
} from './useConversationState.effects';

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
  const autoFocusNonce = useMemo(() => (focus ? Date.now() : undefined), [focus]);

  const xmtpFeed = useXmtpFeed(activeLine, !!convId);
  const events = xmtpFeed.events;
  const { loadOlder, hasMore, loadingOlder } = xmtpFeed;
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
  const [menuAnchor, setMenuAnchor] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, groupDescription, isGroup } = useConvMeta(convId);
  const github = useCachedGroupString(convId, activeLine, isGroup, 'github', getGithubLink);
  const consentAllowed = useConsentGate(convId);
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
  const { savedScrollRef, savedScrollLoaded, didRestoreScroll, pinBottomUntil, isAtBottomRef } = scroll;

  const { reactions, ownReactions, votes, ownVotes, openAnswers } = useFeedDerivations(events, myUri);

  const { optimisticReactions, optimisticRemovals, onReact } = useReactionsLayer(activeLine, reactions, ownReactions);
  const { displayVotes, displayOwnVotes, onVote, displayOpenAnswers, onOpenAnswer } =
    useVotesLayer(activeLine, events, votes, ownVotes, openAnswers, myUri);
  const { signingIds, onSign, payingIds, onPay } = useTxSignLayer(activeLine);

  const {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine);

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
    onOptimistic, onSent, markAtBottom, consentAllowed,
  };
}
