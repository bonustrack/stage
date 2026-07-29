
import { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { HistoryEntry } from '@stage-labs/client/types';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import { MessengerBubble } from '../MessengerBubble';
import { BubbleErrorBoundary } from '../MessengerBubble.boundary';
import type { MessengerBubbleProps } from '../MessengerBubble.props';
import type { MenuAnchor } from '../MessengerBubble.anchor';
import { previewOf } from './feed-helpers';

interface FeedBubbleItemProps {
  item: HistoryEntry;
  dark: boolean;
  myUri: string;
  sub: string;
  senderEthAddress: string | null;
  pending: boolean;
  replyTarget: boolean;
  reactions?: Map<string, number>;
  pendingReactions?: string[];
  pendingRemovals?: string[];
  ownEmojis?: Set<string>;
  replyPreview?: string;
  votes?: MessengerBubbleProps['votes'];
  ownVotes?: MessengerBubbleProps['ownVotes'];
  openAnswers?: MessengerBubbleProps['openAnswers'];
  signing: boolean;
  paying: boolean;
  consentAllowed?: boolean;
  selectable: boolean;
  highlight?: string;
  onAvatarPress: (address: string) => void;
  jumpToMessage: (messageId: string) => void;
  onVote: (messageId: string, questionIndex: number, optionIndex: number, action: 'added' | 'removed') => void;
  onOpenAnswer: (messageId: string, questionIndex: number, text: string) => void;
  onSign: (requestId: string, req: SignatureRequestContent) => void;
  onPay: (requestId: string, wsc: WalletSendCallsContent) => void;
  onReact: (messageId: string, emoji: string) => void;
  setReplyTarget: (id: string, preview: string, sender?: string | null) => void;
  setMenuAnchor: Dispatch<SetStateAction<MenuAnchor>>;
  setMenuFor: Dispatch<SetStateAction<HistoryEntry | null>>;
  onAnswer: (messageId: string, label: string) => void;
}

function signHandlerOf(
  item: HistoryEntry, myUri: string,
  onSign: FeedBubbleItemProps['onSign'],
): (() => void) | undefined {
  const req = (item.payload as { signatureRequest?: SignatureRequestContent } | undefined)?.signatureRequest;
  if (!req || item.from === myUri) return undefined;
  return () => { onSign(item.id, req); };
}

function payHandlerOf(
  item: HistoryEntry, myUri: string,
  onPay: FeedBubbleItemProps['onPay'],
): (() => void) | undefined {
  const wsc = (item.payload as { walletSendCalls?: WalletSendCallsContent } | undefined)?.walletSendCalls;
  if (!wsc || item.from === myUri) return undefined;
  return () => { onPay(item.id, wsc); };
}

function FeedBubbleItemBase({
  item, dark, myUri, sub, senderEthAddress, pending, replyTarget,
  reactions, pendingReactions, pendingRemovals, ownEmojis, replyPreview,
  votes, ownVotes, openAnswers, signing, paying, consentAllowed, selectable, highlight,
  onAvatarPress, jumpToMessage, onVote, onOpenAnswer, onSign, onPay, onReact,
  setReplyTarget, setMenuAnchor, setMenuFor, onAnswer,
}: FeedBubbleItemProps): React.ReactElement {
  return (
    <BubbleErrorBoundary sub={sub} entry={item}>
      <MessengerBubble
        entry={item}
        dark={dark}
        myUri={myUri}
        senderEthAddress={senderEthAddress}
        onAvatarPress={onAvatarPress}
        unread={false}
        pending={pending}
        replyTarget={replyTarget}
        reactions={reactions}
        pendingReactions={pendingReactions}
        pendingRemovals={pendingRemovals}
        ownEmojis={ownEmojis}
        replyPreview={replyPreview}
        onReplyPreviewPress={item.replyTo ? () => { const target = item.replyTo; if (target) jumpToMessage(target); } : undefined}
        votes={votes}
        ownVotes={ownVotes}
        onVote={(qIdx, idx, action) => { onVote(item.id, qIdx, idx, action); }}
        openAnswers={openAnswers}
        onOpenAnswer={(qIdx, text) => { onOpenAnswer(item.id, qIdx, text); }}
        signing={signing}
        consentAllowed={consentAllowed}
        onSign={signHandlerOf(item, myUri, onSign)}
        paying={paying}
        onPay={payHandlerOf(item, myUri, onPay)}
        onReact={(emoji) => { onReact(item.id, emoji); }}
        onReply={() => { setReplyTarget(item.id, previewOf(item), senderEthAddress); }}
        onOpenMenu={(anchor) => { setMenuAnchor(anchor); setMenuFor(item); }}
        onCloseMenu={() => { setMenuFor(null); }}
        selectable={selectable}
        onAnswer={(label) => { onAnswer(item.id, label); }}
        highlight={highlight}
      />
    </BubbleErrorBoundary>
  );
}

export const FeedBubbleItem = memo(FeedBubbleItemBase);
