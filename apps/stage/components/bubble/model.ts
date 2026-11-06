import type { HistoryEntry } from '@stage-labs/client/types';
import type { MenuPoint } from '../AnchoredMenu.model';
import type { CallRecord } from './callCard.model';
import type { PollOpenAnswers, PollOwnVotes, PollVotes } from './poll.model';

export interface MenuAnchor {
  y: number;
  height: number;
  point?: MenuPoint | null;
}

export function initialMenuAnchor(cached: MenuAnchor, hasNode: boolean): MenuAnchor | null {
  const cachedAnchorIsValid = cached.height > 0;
  if (cachedAnchorIsValid || !hasNode) return cached;
  return null;
}

export interface BubbleModel {
  entry: HistoryEntry;
  source: HistoryEntry;
  dark: boolean;
  myUri: string;
  senderEthAddress: string | null;
  pending: boolean;
  replyTarget: boolean;
  interactive: boolean;
  replyPreview?: string;
  reactions?: Map<string, string[]>;
  pendingReactions?: string[];
  pendingRemovals?: string[];
  ownEmojis?: Set<string>;
  votes?: PollVotes;
  ownVotes?: PollOwnVotes;
  openAnswers?: PollOpenAnswers;
  call?: CallRecord;
  signable: boolean;
  signing: boolean;
  payable: boolean;
  paying: boolean;
  consentAllowed?: boolean;
  selectable: boolean;
  highlight?: string;
}

export type VoteAction = 'added' | 'removed';

export interface FeedActions {
  react: (entry: HistoryEntry, emoji: string) => void;
  reply: (entry: HistoryEntry) => void;
  openMenu: (entry: HistoryEntry, anchor: MenuAnchor) => void;
  jumpToReply: (entry: HistoryEntry) => void;
  openProfile: (address: string) => void;
  vote: (entry: HistoryEntry, questionIndex: number, optionIndex: number, action: VoteAction) => void;
  openAnswer: (entry: HistoryEntry, questionIndex: number, text: string) => void;
  sign: (entry: HistoryEntry) => void;
  pay: (entry: HistoryEntry) => void;
  endSelection: () => void;
}

export interface BubbleHandlers {
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onOpenMenu?: (anchor: MenuAnchor) => void;
  onReplyPreviewPress?: () => void;
  onAvatarPress?: (address: string) => void;
  onVote?: (questionIndex: number, optionIndex: number, action: VoteAction) => void;
  onOpenAnswer?: (questionIndex: number, text: string) => void;
  onSign?: () => void;
  onPay?: () => void;
  onEndSelection?: () => void;
}

function interactiveHandlers(entry: HistoryEntry, actions: FeedActions): BubbleHandlers {
  return {
    onReact: (emoji) => {
      actions.react(entry, emoji);
    },
    onReply: () => {
      actions.reply(entry);
    },
    onOpenMenu: (anchor) => {
      actions.openMenu(entry, anchor);
    },
    onReplyPreviewPress: entry.replyTo
      ? () => {
          actions.jumpToReply(entry);
        }
      : undefined,
  };
}

export function bubbleHandlers(model: BubbleModel, actions: FeedActions | undefined): BubbleHandlers {
  if (actions === undefined) return {};
  const entry = model.source;
  return {
    ...(model.interactive ? interactiveHandlers(entry, actions) : {}),
    onAvatarPress: actions.openProfile,
    onVote: (questionIndex, optionIndex, action) => {
      actions.vote(entry, questionIndex, optionIndex, action);
    },
    onOpenAnswer: (questionIndex, text) => {
      actions.openAnswer(entry, questionIndex, text);
    },
    onSign: model.signable
      ? () => {
          actions.sign(entry);
        }
      : undefined,
    onPay: model.payable
      ? () => {
          actions.pay(entry);
        }
      : undefined,
    onEndSelection: actions.endSelection,
  };
}
