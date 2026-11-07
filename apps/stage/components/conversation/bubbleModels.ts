import type { HistoryEntry } from '@stage-labs/client/types';
import type { DeletedMessages } from '@stage-labs/client/xmtp/deletions';
import { signatureRequestOf, walletSendCallsOf } from '@stage-labs/client/xmtp/entryPayload';
import type { BubbleModel } from '../bubble/model';
import type { CallRecord } from '../bubble/callCard.model';
import type { PollOpenAnswers, PollOwnVotes, PollVotes } from '../bubble/poll.model';
import { isLocalId } from '../composer/outbound';

export interface BubbleFeedState {
  myUri: string;
  consentAllowed?: boolean;
  senderEthOf: (from: string) => string | null;
  namedEntry: (item: HistoryEntry) => HistoryEntry;
  quoteOf: (item: HistoryEntry) => string | undefined;
  deletedIds: DeletedMessages;
  confirmedIds: ReadonlyMap<string, string>;
  replyingToId?: string;
  menuForId?: string;
  jumpHighlightId: string | null;
  selectedForCopy: string | null;
  reactorNames: ReadonlyMap<string, Map<string, string[]>>;
  optimisticReactions: ReadonlyMap<string, string[]>;
  optimisticRemovals: ReadonlyMap<string, string[]>;
  ownReactions: ReadonlyMap<string, Set<string>>;
  votes: ReadonlyMap<string, PollVotes>;
  ownVotes: ReadonlyMap<string, PollOwnVotes>;
  openAnswers: ReadonlyMap<string, PollOpenAnswers>;
  callRecords: ReadonlyMap<string, CallRecord>;
  signingIds: ReadonlySet<string>;
  payingIds: ReadonlySet<string>;
}

interface BubbleView {
  dark: boolean;
  highlight?: string;
}

type LiveFields = Pick<BubbleModel, 'replyPreview' | 'reactions' | 'pendingReactions' | 'pendingRemovals' | 'ownEmojis' | 'call'>;

function liveFields(item: HistoryEntry, s: BubbleFeedState): LiveFields {
  const id = item.id;
  return {
    replyPreview: s.quoteOf(item),
    reactions: s.reactorNames.get(id),
    pendingReactions: s.optimisticReactions.get(id),
    pendingRemovals: s.optimisticRemovals.get(id),
    ownEmojis: s.ownReactions.get(id),
    call: s.callRecords.get(id),
  };
}

const DELETED_FIELDS: LiveFields = {};

function isMarked(id: string, s: BubbleFeedState): boolean {
  return s.replyingToId === id || s.jumpHighlightId === id || s.menuForId === id;
}

function fromOthers(item: HistoryEntry, s: BubbleFeedState, read: (entry: HistoryEntry) => object | undefined): boolean {
  return read(item) !== undefined && item.from !== s.myUri;
}

export function bubbleModelOf(item: HistoryEntry, s: BubbleFeedState, view: BubbleView): BubbleModel {
  const id = item.id;
  const deleted = s.deletedIds.has(id);
  return {
    entry: s.namedEntry(item),
    source: item,
    dark: view.dark,
    myUri: s.myUri,
    senderEthAddress: s.senderEthOf(item.from),
    pending: isLocalId(id) && !s.confirmedIds.has(id),
    replyTarget: isMarked(id, s),
    interactive: !deleted,
    ...(deleted ? DELETED_FIELDS : liveFields(item, s)),
    votes: s.votes.get(id),
    ownVotes: s.ownVotes.get(id),
    openAnswers: s.openAnswers.get(id),
    signable: fromOthers(item, s, signatureRequestOf),
    signing: s.signingIds.has(id),
    payable: fromOthers(item, s, walletSendCallsOf),
    paying: s.payingIds.has(id),
    consentAllowed: s.consentAllowed,
    selectable: !deleted && s.selectedForCopy === id,
    highlight: view.highlight,
  };
}

function sameModel(a: BubbleModel, b: BubbleModel): boolean {
  const keys = Object.keys(a) as (keyof BubbleModel)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export function reconcileBubbleModels(
  previous: ReadonlyMap<string, BubbleModel>,
  items: readonly HistoryEntry[],
  build: (item: HistoryEntry) => BubbleModel,
): ReadonlyMap<string, BubbleModel> {
  const next = new Map<string, BubbleModel>();
  let reused = previous.size === items.length;
  for (const item of items) {
    const built = build(item);
    const before = previous.get(item.id);
    const kept = before !== undefined && sameModel(before, built) ? before : built;
    if (kept !== before) reused = false;
    next.set(item.id, kept);
  }
  return reused ? previous : next;
}
