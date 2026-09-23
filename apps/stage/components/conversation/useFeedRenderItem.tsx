
import { useCallback, useMemo } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import { MessengerBubble } from '../bubble/MessengerBubble';
import { BubbleErrorBoundary } from '../bubble/boundary';
import { usePalette } from '../../lib/theme';
import { previewOf } from './feed-helpers';
import type { useConversationState } from './useConversationState';
import { profileLinkOf } from '../../lib/links';

type ConvState = ReturnType<typeof useConversationState>;
type Bubble = ConvState['allBubbles'][number];

function signHandlerOf(item: HistoryEntry, myUri: string, onSign: ConvState['onSign']): (() => void) | undefined {
  const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
  if (!req || item.from === myUri) return undefined;
  return () => { onSign(item.id, req); };
}

function payHandlerOf(item: HistoryEntry, myUri: string, onPay: ConvState['onPay']): (() => void) | undefined {
  const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
  if (!wsc || item.from === myUri) return undefined;
  return () => { onPay(item.id, wsc); };
}

export function useFeedRenderItem(
  c: ConvState,
  dark: boolean,
  router: { push: (h: { pathname: '/profile/[address]'; params: { address: string } }) => void },
  highlight?: string,
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
    setMenuAnchor, setMenuFor, setReplyTarget, selectedForCopy, consentAllowed,
  } = c;

  const sub = usePalette().text;
  const replyingToId = replyingTo?.id;

  const extraData = useMemo(
    () => [profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, confirmedIds, selectedForCopy, groupDescription, groupLabels, consentAllowed, signingIds, payingIds, replyingToId, jumpHighlightId],
    [profilesVersion, optimisticReactions, reactions, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, confirmedIds, selectedForCopy, groupDescription, groupLabels, consentAllowed, signingIds, payingIds, replyingToId, jumpHighlightId],
  );

  const eventsById = useMemo(() => {
    const m = new Map<string, Bubble>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const onAvatarPress = useCallback((address: string) => {
    router.push(profileLinkOf(address));
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Bubble }) => {
    const senderEthAddress = senderEthOf(item.from);
    const target = item.replyTo;
    return (
      <BubbleErrorBoundary sub={sub} entry={item}>
        <MessengerBubble
          entry={item}
          dark={dark}
          myUri={myUri}
          senderEthAddress={senderEthAddress}
          onAvatarPress={onAvatarPress}
          pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
          replyTarget={replyingToId === item.id || jumpHighlightId === item.id}
          reactions={reactions.get(item.id)}
          pendingReactions={optimisticReactions.get(item.id)}
          pendingRemovals={optimisticRemovals.get(item.id)}
          ownEmojis={ownReactions.get(item.id)}
          replyPreview={target ? previewOf(eventsById.get(target) ?? item) : undefined}
          onReplyPreviewPress={target ? () => { jumpToMessage(target); } : undefined}
          votes={displayVotes.get(item.id)}
          ownVotes={displayOwnVotes.get(item.id)}
          onVote={(qIdx, idx, action) => { onVote(item.id, qIdx, idx, action); }}
          openAnswers={displayOpenAnswers.get(item.id)}
          onOpenAnswer={(qIdx, text) => { onOpenAnswer(item.id, qIdx, text); }}
          signing={signingIds.has(item.id)}
          consentAllowed={consentAllowed}
          onSign={signHandlerOf(item, myUri, onSign)}
          paying={payingIds.has(item.id)}
          onPay={payHandlerOf(item, myUri, onPay)}
          onReact={(emoji) => { onReact(item.id, emoji); }}
          onReply={() => { setReplyTarget(item.id, previewOf(item), senderEthAddress); }}
          onOpenMenu={(anchor) => { setMenuAnchor(anchor); setMenuFor(item); }}
          selectable={selectedForCopy === item.id}
          onAnswer={(label) => { onAnswer(item.id, label); }}
          highlight={highlight}
        />
      </BubbleErrorBoundary>
    );
  }, [
    dark, myUri, sub, senderEthOf, confirmedIds, replyingToId, jumpHighlightId,
    reactions, optimisticReactions, optimisticRemovals, ownReactions, eventsById,
    displayVotes, displayOwnVotes, displayOpenAnswers, signingIds, payingIds,
    consentAllowed, selectedForCopy, highlight,
    onAvatarPress, jumpToMessage, onVote, onOpenAnswer, onSign, onPay, onReact,
    setReplyTarget, setMenuAnchor, setMenuFor, onAnswer,
  ]);

  return { renderItem, extraData };
}
