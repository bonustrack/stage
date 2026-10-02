
import { useCallback, useMemo } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import { MessengerBubble } from '../bubble/MessengerBubble';
import { BubbleErrorBoundary } from '../bubble/boundary';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { useRouter } from 'expo-router';
import { previewOf } from './feed-helpers';
import { replyQuoteOf } from './messageDeletion.model';
import type { useConversationState } from './useConversationState';
import { profileLinkOf } from '../../lib/links';
import { XMTP_USER_PREFIX } from '../../modules/messaging';
import { memberNamer, withMemberNames } from './systemNames.model';
import { useReactorNames } from './useReactorNames';

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

function unlessDeleted<T>(deleted: boolean, byId: ReadonlyMap<string, T>, id: string): T | undefined {
  return deleted ? undefined : byId.get(id);
}

type BubbleInteractions = Pick<
  React.ComponentProps<typeof MessengerBubble>, 'replyPreview' | 'onReplyPreviewPress' | 'onReact' | 'onReply' | 'onOpenMenu'
>;

function interactionsOf(deleted: boolean, live: () => BubbleInteractions): BubbleInteractions {
  return deleted ? {} : live();
}

export function useFeedRenderItem(c: ConvState, highlight?: string): {
  renderItem: ({ item }: { item: Bubble }) => React.ReactElement;
  extraData: readonly unknown[];
} {
  const {
    events, myUri, replyingTo, jumpHighlightId, menuFor,
    confirmedIds, optimisticReactions, optimisticRemovals,
    groupDescription, groupLabels, senderEthOf, profilesVersion,
    reactions, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, callRecords, jumpToMessage,
    onReact, onSign, signingIds, onVote, onOpenAnswer, onPay, payingIds, onAnswer,
    setMenuAnchor, setMenuFor, setReplyTarget, selectedForCopy, consentAllowed, deletedIds,
  } = c;

  const sub = usePalette().text;
  const dark = useEffectiveColorScheme() === 'dark';
  const router = useRouter();
  const replyingToId = replyingTo?.id;
  const menuForId = menuFor?.id;
  const reactorNames = useReactorNames(reactions, myUri, senderEthOf, profilesVersion);

  const extraData = useMemo(
    () => [profilesVersion, optimisticReactions, reactorNames, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, callRecords, confirmedIds, selectedForCopy, groupDescription, groupLabels, consentAllowed, signingIds, payingIds, replyingToId, jumpHighlightId, menuForId, deletedIds],
    [profilesVersion, optimisticReactions, reactorNames, optimisticRemovals, ownReactions, displayVotes, displayOwnVotes, displayOpenAnswers, callRecords, confirmedIds, selectedForCopy, groupDescription, groupLabels, consentAllowed, signingIds, payingIds, replyingToId, jumpHighlightId, menuForId, deletedIds],
  );

  const eventsById = useMemo(() => {
    const m = new Map<string, Bubble>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  const namedEntry = useMemo(() => {
    const selfInboxId = myUri.startsWith(XMTP_USER_PREFIX) ? myUri.slice(XMTP_USER_PREFIX.length) || null : null;
    const nameOf = memberNamer(selfInboxId, inboxId => senderEthOf(`${XMTP_USER_PREFIX}${inboxId}`));
    const cache = new WeakMap<Bubble, Bubble>();
    return (item: Bubble): Bubble => {
      const hit = cache.get(item);
      if (hit) return hit;
      const named = withMemberNames(item, nameOf);
      cache.set(item, named);
      return named;
    };
  }, [myUri, senderEthOf]);

  const onAvatarPress = useCallback((address: string) => {
    router.push(profileLinkOf(address));
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Bubble }) => {
    const senderEthAddress = senderEthOf(item.from);
    const deleted = deletedIds.has(item.id);
    const target = item.replyTo;
    return (
      <BubbleErrorBoundary sub={sub} entry={item}>
        <MessengerBubble
          entry={namedEntry(item)}
          dark={dark}
          myUri={myUri}
          senderEthAddress={senderEthAddress}
          onAvatarPress={onAvatarPress}
          pending={item.id.startsWith('tmp_') && !confirmedIds.has(item.id)}
          replyTarget={replyingToId === item.id || jumpHighlightId === item.id || menuForId === item.id}
          reactions={unlessDeleted(deleted, reactorNames, item.id)}
          pendingReactions={unlessDeleted(deleted, optimisticReactions, item.id)}
          pendingRemovals={unlessDeleted(deleted, optimisticRemovals, item.id)}
          ownEmojis={unlessDeleted(deleted, ownReactions, item.id)}
          {...interactionsOf(deleted, () => ({
            replyPreview: replyQuoteOf(item, deletedIds, id => eventsById.get(id)),
            onReplyPreviewPress: target ? () => { jumpToMessage(target); } : undefined,
            onReact: (emoji) => { onReact(item.id, emoji); },
            onReply: () => { setReplyTarget(item.id, previewOf(item), senderEthAddress); },
            onOpenMenu: (anchor) => { setMenuAnchor(anchor); setMenuFor(item); },
          }))}
          votes={displayVotes.get(item.id)}
          ownVotes={displayOwnVotes.get(item.id)}
          onVote={(qIdx, idx, action) => { onVote(item.id, qIdx, idx, action); }}
          openAnswers={displayOpenAnswers.get(item.id)}
          onOpenAnswer={(qIdx, text) => { onOpenAnswer(item.id, qIdx, text); }}
          call={unlessDeleted(deleted, callRecords, item.id)}
          signing={signingIds.has(item.id)}
          consentAllowed={consentAllowed}
          onSign={signHandlerOf(item, myUri, onSign)}
          paying={payingIds.has(item.id)}
          onPay={payHandlerOf(item, myUri, onPay)}
          selectable={selectedForCopy === item.id}
          onAnswer={(label) => { onAnswer(item.id, label); }}
          highlight={highlight}
        />
      </BubbleErrorBoundary>
    );
  }, [
    dark, myUri, sub, senderEthOf, namedEntry, deletedIds, confirmedIds, replyingToId, jumpHighlightId, menuForId,
    reactorNames, optimisticReactions, optimisticRemovals, ownReactions, eventsById,
    displayVotes, displayOwnVotes, displayOpenAnswers, callRecords, signingIds, payingIds,
    consentAllowed, selectedForCopy, highlight,
    onAvatarPress, jumpToMessage, onVote, onOpenAnswer, onSign, onPay, onReact,
    setReplyTarget, setMenuAnchor, setMenuFor, onAnswer,
  ]);

  return { renderItem, extraData };
}
