
import { useCallback, useMemo } from 'react';
import { FeedBubbleItem } from './FeedBubbleItem';
import { usePalette } from '../../lib/theme';
import { previewOf } from './feed-helpers';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;
type Bubble = ConvState['allBubbles'][number];

export function useFeedRenderItem(
  c: ConvState,
  dark: boolean,
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void },
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
    router.push({ pathname: '/user/[address]', params: { address } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Bubble }) => (
    <FeedBubbleItem
      item={item}
      dark={dark}
      myUri={myUri}
      sub={sub}
      senderEthAddress={senderEthOf(item.from)}
      pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
      replyTarget={replyingToId === item.id || jumpHighlightId === item.id}
      reactions={reactions.get(item.id)}
      pendingReactions={optimisticReactions.get(item.id)}
      pendingRemovals={optimisticRemovals.get(item.id)}
      ownEmojis={ownReactions.get(item.id)}
      replyPreview={item.replyTo ? previewOf(eventsById.get(item.replyTo) ?? item) : undefined}
      votes={displayVotes.get(item.id)}
      ownVotes={displayOwnVotes.get(item.id)}
      openAnswers={displayOpenAnswers.get(item.id)}
      signing={signingIds.has(item.id)}
      paying={payingIds.has(item.id)}
      consentAllowed={consentAllowed}
      selectable={selectedForCopy === item.id}
      highlight={highlight}
      onAvatarPress={onAvatarPress}
      jumpToMessage={jumpToMessage}
      onVote={onVote}
      onOpenAnswer={onOpenAnswer}
      onSign={onSign}
      onPay={onPay}
      onReact={onReact}
      setReplyTarget={setReplyTarget}
      setMenuAnchor={setMenuAnchor}
      setMenuFor={setMenuFor}
      onAnswer={onAnswer}
    />
  ), [
    dark, myUri, sub, senderEthOf, confirmedIds, replyingToId, jumpHighlightId,
    reactions, optimisticReactions, optimisticRemovals, ownReactions, eventsById,
    displayVotes, displayOwnVotes, displayOpenAnswers, signingIds, payingIds,
    consentAllowed, selectedForCopy, highlight,
    onAvatarPress, jumpToMessage, onVote, onOpenAnswer, onSign, onPay, onReact,
    setReplyTarget, setMenuAnchor, setMenuFor, onAnswer,
  ]);

  return { renderItem, extraData };
}
