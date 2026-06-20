/** @file State + side-effects + action wiring for the XMTP conversation screen — the route owns only the render tree; reaction/vote/tx-sign layers are own hooks. */

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

/** Reply-target state with a monotonic nonce so the composer's focus effect re-fires per reply. */
function useReplyTarget() {
  const [replyingTo, setReplyingTo] = useState<{ id: string; preview: string; sender?: string | null; nonce: number } | null>(null);
  const replyNonceRef = useRef(0);
  const setReplyTarget = useCallback((id: string, preview: string, sender?: string | null) => {
    replyNonceRef.current += 1;
    setReplyingTo({ id, preview, sender, nonce: replyNonceRef.current });
  }, []);
  return { replyingTo, setReplyingTo, setReplyTarget };
}

/** Map the raw feed status into the conversation's coarse status. */
function feedStatus(s: string): 'idle' | 'connecting' | 'open' | 'error' {
  if (s === 'open') return 'open';
  if (s === 'loading') return 'connecting';
  if (s === 'error') return 'error';
  return 'idle';
}

/** Resolve @-mention candidates (group members sans self, or the lone DM peer) from the profile cache. */
function useMentionCandidates(isGroup: boolean, memberAddrs: string[], peerAddr: string | null, profilesVersion: number) {
  return useMemo(() => {
    const seen = new Set<string>();
    const out: { address: string; name: string }[] = [];
    /** Add helper. */
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

/** Provides the aggregated state (feed, votes, reactions, outbound) for a conversation. */
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
  useActiveConvSuppression(convId);
  const status = feedStatus(xmtpFeed.status);
  const myUri = xmtpFeed.inboxId ? `${XMTP_USER_PREFIX}${xmtpFeed.inboxId}` : XMTP_USER_PREFIX;

  const { replyingTo, setReplyingTo, setReplyTarget } = useReplyTarget();
  const [menuFor, setMenuFor] = useState<HistoryEntry | null>(null);
  /** Id of the "Select"-tapped message — its body renders selectable for copy. */
  const [selectedForCopy, setSelectedForCopy] = useState<string | null>(null);
  /** On-screen rect of the tapped message row — anchors the action menu. */
  const [menuAnchor, setMenuAnchor] = useState<{ y: number; height: number }>({ y: 0, height: 0 });
  /** Topnav overflow (3-dot) menu open state. */
  const [overflowOpen, setOverflowOpen] = useState(false);
  /** Conversation metadata via TanStack Query — cached by convId. */
  const { peerAddr, memberAddrs, inboxToAddr, groupName, groupImage, groupDescription, isGroup } = useConvMeta(convId);
  /** Synced-appData github link; seeds from cache then refreshes — drives the topnav GitHub icon. */
  const github = useCachedGroupString(convId, activeLine, isGroup, 'github', getGithubLink);
  const consentAllowed = useConsentGate(convId);
  const groupLabels = useGroupLabels(convId, activeLine, isGroup);

  const senderEthOf = useCallback((from: string): string | null => {
    if (!from.startsWith(XMTP_USER_PREFIX)) return null;
    const inboxId = from.slice(XMTP_USER_PREFIX.length);
    return inboxToAddr[inboxId] ?? null;
  }, [inboxToAddr]);

  /** Our own eth address so our OWN bubbles resolve a stamp name/avatar (a DM's memberAddrs is empty). */
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

  /** Optimistic outbound + inverted-list scroll/jump layer. */
  const {
    showJump, setShowJump, listEpoch, setListEpoch, jumpHighlightId,
    listRef, confirmedIds, allBubbles, jumpToMessage, onOptimistic, onSent,
  } = useOutboundLayer(events, myUri, convId, activeLine);

  /** Jump-to-bottom pressed → list remounts to offset 0 (newest) but may not emit an onScroll, so flag at-bottom + persist sentinel 0 now to survive leave. */
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
    onOptimistic, onSent, markAtBottom, consentAllowed,
  };
}
