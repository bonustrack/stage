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
import { XMTP_USER_PREFIX } from '@stage-labs/client/xmtp/line';
import { memberNamer, withMemberNames } from './systemNames.model';
import { getPeerName } from '../../lib/peerProfiles';
import { useReconciledMap } from '../../lib/mapReconcile';
import { reactorNamer, reactorNamesByMessage } from './reactors.model';

type ConvState = ReturnType<typeof useConversationState>;
type Bubble = ConvState['allBubbles'][number];

function useReactorNames(
  reactions: Map<string, Map<string, string[]>>,
  myUri: string,
  addressOf: (uri: string) => string | null,
  profilesVersion: number,
): Map<string, Map<string, string[]>> {
  const named = useMemo(
    () => reactorNamesByMessage(reactions, myUri, reactorNamer(addressOf, getPeerName)),
    [reactions, myUri, addressOf, profilesVersion],
  );
  return useReconciledMap(named);
}

function signHandlerOf(item: HistoryEntry, myUri: string, onSign: ConvState['onSign']): (() => void) | undefined {
  const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
  if (!req || item.from === myUri) return undefined;
  return () => {
    onSign(item.id, req);
  };
}

function payHandlerOf(item: HistoryEntry, myUri: string, onPay: ConvState['onPay']): (() => void) | undefined {
  const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
  if (!wsc || item.from === myUri) return undefined;
  return () => {
    onPay(item.id, wsc);
  };
}

function unlessDeleted<T>(deleted: boolean, byId: ReadonlyMap<string, T>, id: string): T | undefined {
  return deleted ? undefined : byId.get(id);
}

type BubbleInteractions = Pick<
  React.ComponentProps<typeof MessengerBubble>,
  'replyPreview' | 'onReplyPreviewPress' | 'onReact' | 'onReply' | 'onOpenMenu'
>;

function interactionsOf(deleted: boolean, live: () => BubbleInteractions): BubbleInteractions {
  return deleted ? {} : live();
}

interface FeedLocals {
  sub: string;
  dark: boolean;
  replyingToId: string | undefined;
  menuForId: string | undefined;
  reactorNames: Map<string, Map<string, string[]>>;
  eventsById: Map<string, HistoryEntry>;
  namedEntry: (item: Bubble) => Bubble;
  endSelection: () => void;
  onAvatarPress: (address: string) => void;
  highlight: string | undefined;
}

type RenderItem = ({ item }: { item: Bubble }) => React.ReactElement;

function useFeedExtraData(c: ConvState, l: Pick<FeedLocals, 'reactorNames' | 'replyingToId' | 'menuForId'>): readonly unknown[] {
  const {
    profilesVersion,
    optimisticReactions,
    optimisticRemovals,
    ownReactions,
    displayVotes,
    displayOwnVotes,
    displayOpenAnswers,
    callRecords,
    confirmedIds,
    selectedForCopy,
    groupDescription,
    groupLabels,
    consentAllowed,
    signingIds,
    payingIds,
    jumpHighlightId,
    deletedIds,
  } = c;
  const { reactorNames, replyingToId, menuForId } = l;
  return useMemo(
    () => [
      profilesVersion,
      optimisticReactions,
      reactorNames,
      optimisticRemovals,
      ownReactions,
      displayVotes,
      displayOwnVotes,
      displayOpenAnswers,
      callRecords,
      confirmedIds,
      selectedForCopy,
      groupDescription,
      groupLabels,
      consentAllowed,
      signingIds,
      payingIds,
      replyingToId,
      jumpHighlightId,
      menuForId,
      deletedIds,
    ],
    [
      profilesVersion,
      optimisticReactions,
      reactorNames,
      optimisticRemovals,
      ownReactions,
      displayVotes,
      displayOwnVotes,
      displayOpenAnswers,
      callRecords,
      confirmedIds,
      selectedForCopy,
      groupDescription,
      groupLabels,
      consentAllowed,
      signingIds,
      payingIds,
      replyingToId,
      jumpHighlightId,
      menuForId,
      deletedIds,
    ],
  );
}

function renderFeedBubble(item: Bubble, c: ConvState, l: FeedLocals): React.ReactElement {
  const { deletedIds, myUri } = c;
  const senderEthAddress = c.senderEthOf(item.from);
  const deleted = deletedIds.has(item.id);
  const target = item.replyTo;
  return (
    <BubbleErrorBoundary sub={l.sub} entry={item}>
      <MessengerBubble
        entry={l.namedEntry(item)}
        dark={l.dark}
        myUri={myUri}
        senderEthAddress={senderEthAddress}
        onAvatarPress={l.onAvatarPress}
        pending={item.id.startsWith('tmp_') && !c.confirmedIds.has(item.id)}
        replyTarget={l.replyingToId === item.id || c.jumpHighlightId === item.id || l.menuForId === item.id}
        reactions={unlessDeleted(deleted, l.reactorNames, item.id)}
        pendingReactions={unlessDeleted(deleted, c.optimisticReactions, item.id)}
        pendingRemovals={unlessDeleted(deleted, c.optimisticRemovals, item.id)}
        ownEmojis={unlessDeleted(deleted, c.ownReactions, item.id)}
        {...interactionsOf(deleted, () => ({
          replyPreview: replyQuoteOf(item, deletedIds, (id) => l.eventsById.get(id)),
          onReplyPreviewPress: target
            ? () => {
                c.jumpToMessage(target);
              }
            : undefined,
          onReact: (emoji) => {
            c.onReact(item.id, emoji);
          },
          onReply: () => {
            c.setReplyTarget(item.id, previewOf(item), senderEthAddress);
          },
          onOpenMenu: (anchor) => {
            c.setMenuAnchor(anchor);
            c.setMenuFor(item);
          },
        }))}
        votes={c.displayVotes.get(item.id)}
        ownVotes={c.displayOwnVotes.get(item.id)}
        onVote={(qIdx, idx, action) => {
          c.onVote(item.id, qIdx, idx, action);
        }}
        openAnswers={c.displayOpenAnswers.get(item.id)}
        onOpenAnswer={(qIdx, text) => {
          c.onOpenAnswer(item.id, qIdx, text);
        }}
        call={unlessDeleted(deleted, c.callRecords, item.id)}
        signing={c.signingIds.has(item.id)}
        consentAllowed={c.consentAllowed}
        onSign={signHandlerOf(item, myUri, c.onSign)}
        paying={c.payingIds.has(item.id)}
        onPay={payHandlerOf(item, myUri, c.onPay)}
        selectable={!deleted && c.selectedForCopy === item.id}
        onEndSelection={l.endSelection}
        onAnswer={(label) => {
          c.onAnswer(item.id, label);
        }}
        highlight={l.highlight}
      />
    </BubbleErrorBoundary>
  );
}

function useBubbleRenderer(c: ConvState, l: FeedLocals): RenderItem {
  return useCallback(
    ({ item }: { item: Bubble }) => renderFeedBubble(item, c, l),
    [
      l.dark,
      c.myUri,
      l.sub,
      c.senderEthOf,
      l.namedEntry,
      c.deletedIds,
      c.confirmedIds,
      l.replyingToId,
      c.jumpHighlightId,
      l.menuForId,
      l.reactorNames,
      c.optimisticReactions,
      c.optimisticRemovals,
      c.ownReactions,
      l.eventsById,
      c.displayVotes,
      c.displayOwnVotes,
      c.displayOpenAnswers,
      c.callRecords,
      c.signingIds,
      c.payingIds,
      c.consentAllowed,
      c.selectedForCopy,
      l.endSelection,
      l.highlight,
      l.onAvatarPress,
      c.jumpToMessage,
      c.onVote,
      c.onOpenAnswer,
      c.onSign,
      c.onPay,
      c.onReact,
      c.setReplyTarget,
      c.setMenuAnchor,
      c.setMenuFor,
      c.onAnswer,
    ],
  );
}

export function useFeedRenderItem(c: ConvState, highlight?: string): { renderItem: RenderItem; extraData: readonly unknown[] } {
  const { events, myUri, senderEthOf, profilesVersion, reactions, setSelectedForCopy } = c;
  const sub = usePalette().text;
  const dark = useEffectiveColorScheme() === 'dark';
  const router = useRouter();
  const replyingToId = c.replyingTo?.id;
  const menuForId = c.menuFor?.id;
  const reactorNames = useReactorNames(reactions, myUri, senderEthOf, profilesVersion);
  const extraData = useFeedExtraData(c, { reactorNames, replyingToId, menuForId });

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const namedEntry = useMemo(() => {
    const selfInboxId = myUri.startsWith(XMTP_USER_PREFIX) ? myUri.slice(XMTP_USER_PREFIX.length) || null : null;
    const nameOf = memberNamer(selfInboxId, (inboxId) => senderEthOf(`${XMTP_USER_PREFIX}${inboxId}`));
    const cache = new WeakMap<Bubble, Bubble>();
    return (item: Bubble): Bubble => {
      const hit = cache.get(item);
      if (hit) return hit;
      const named = withMemberNames(item, nameOf);
      cache.set(item, named);
      return named;
    };
  }, [myUri, senderEthOf]);

  const endSelection = useCallback(() => {
    setSelectedForCopy(null);
  }, [setSelectedForCopy]);

  const onAvatarPress = useCallback(
    (address: string) => {
      router.push(profileLinkOf(address));
    },
    [router],
  );

  const renderItem = useBubbleRenderer(c, {
    sub,
    dark,
    replyingToId,
    menuForId,
    reactorNames,
    eventsById,
    namedEntry,
    endSelection,
    onAvatarPress,
    highlight,
  });

  return { renderItem, extraData };
}
