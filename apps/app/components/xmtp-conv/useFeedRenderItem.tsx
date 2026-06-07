/** Stable FlatList renderItem + extraData for the conversation feed, extracted
 *  from ConversationFeed.tsx to keep both files under the 200-line lint cap.
 *
 *  Perf: a fresh renderItem closure or extraData array every parent render
 *  defeats MessengerBubble's React.memo for the whole visible window. Both are
 *  memoised here (useCallback / useMemo) with minimal, render-affecting dep
 *  lists; the action callbacks they close over are already stable (useCallback
 *  in useConversationState / setState identities). The reply-preview lookup uses
 *  an id→event Map (O(1)) instead of an O(n) `events.find` per bubble. */

import { useCallback, useMemo } from 'react';
import { MessengerBubble } from '../MessengerBubble';
import { previewOf } from './feed-helpers';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;
type Bubble = ConvState['allBubbles'][number];

export function useFeedRenderItem(
  c: ConvState,
  dark: boolean,
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void },
): {
  renderItem: ({ item }: { item: Bubble }) => React.ReactElement;
  extraData: readonly unknown[];
} {
  const {
    events, myUri, replyingTo, jumpHighlightId,
    confirmedIds, optimisticReactions, optimisticRemovals,
    groupDescription, groupLabels, senderEthOf, profilesVersion,
    reactions, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, jumpToMessage,
    onReact, onSign, signingIds, onVote, onOpenAnswer, onPay, payingIds, onAnswer,
    setMenuAnchor, setMenuFor, setReplyTarget, selectedForCopy,
  } = c;

  /** Referentially-stable extraData — only a NEW array when a render-affecting
   *  value actually changes, so the list doesn't re-render the whole window on
   *  every parent re-render. Mirrors the prior inline list. */
  const extraData = useMemo(
    () => [profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, confirmedIds, selectedForCopy, groupDescription, groupLabels],
    [profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, confirmedIds, selectedForCopy, groupDescription, groupLabels],
  );

  /** id → event map, built once per `events` change → O(1) reply-preview lookup
   *  instead of an O(n) `events.find` per bubble (was O(n²) over the window). */
  const eventsById = useMemo(() => {
    const m = new Map<string, Bubble>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const renderItem = useCallback(({ item }: { item: Bubble }) => (
    <MessengerBubble
      entry={item}
      dark={dark}
      myUri={myUri}
      senderEthAddress={senderEthOf(item.from)}
      onAvatarPress={(addr) => router.push({ pathname: '/user/[address]', params: { address: addr } })}
      unread={false}
      pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
      replyTarget={replyingTo?.id === item.id || jumpHighlightId === item.id}
      reactions={reactions.get(item.id)}
      pendingReactions={optimisticReactions.get(item.id)}
      pendingRemovals={optimisticRemovals.get(item.id)}
      ownEmojis={ownReactions.get(item.id)}
      replyPreview={item.replyTo ? previewOf(eventsById.get(item.replyTo) ?? item) : undefined}
      onReplyPreviewPress={item.replyTo ? () => jumpToMessage(item.replyTo as string) : undefined}
      votes={displayVotes.get(item.id)}
      ownVotes={displayOwnVotes.get(item.id)}
      onVote={(qIdx, idx, action) => onVote(item.id, qIdx, idx, action)}
      openAnswers={displayOpenAnswers.get(item.id)}
      onOpenAnswer={(qIdx, text) => onOpenAnswer(item.id, qIdx, text)}
      signing={signingIds.has(item.id)}
      onSign={(() => {
        const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
        if (!req || item.from === myUri) return undefined;
        return () => onSign(item.id, req);
      })()}
      paying={payingIds.has(item.id)}
      onPay={(() => {
        const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
        if (!wsc || item.from === myUri) return undefined;
        return () => onPay(item.id, wsc);
      })()}
      onReact={(emoji) => onReact(item.id, emoji)}
      onReply={() => setReplyTarget(item.id, previewOf(item), senderEthOf(item.from))}
      onOpenMenu={(anchor) => { setMenuAnchor(anchor); setMenuFor(item); }}
      onCloseMenu={() => setMenuFor(null)}
      selectable={selectedForCopy === item.id}
      onAnswer={(label) => onAnswer(item.id, label)}
    />
  ), [
    dark, myUri, senderEthOf, router, confirmedIds, replyingTo?.id, jumpHighlightId,
    reactions, optimisticReactions, optimisticRemovals, ownReactions, eventsById, jumpToMessage,
    displayVotes, displayOwnVotes, displayOpenAnswers, onVote, onOpenAnswer, signingIds, onSign, payingIds, onPay, onReact,
    setReplyTarget, setMenuAnchor, setMenuFor, selectedForCopy, onAnswer,
  ]);

  return { renderItem, extraData };
}
