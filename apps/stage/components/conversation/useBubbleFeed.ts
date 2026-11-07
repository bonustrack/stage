import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { HistoryEntry } from '@stage-labs/client/types';
import { inboxIdOfUri, userUriOf } from '@stage-labs/client/xmtp/line';
import { signatureRequestOf, walletSendCallsOf } from '@stage-labs/client/xmtp/entryPayload';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';
import type { WalletSendCallsContent } from '@stage-labs/client/xmtp/tx';
import type { FeedActions, MenuAnchor, VoteAction } from '../bubble/model';
import { reactorNamer, reactorNamesByMessage } from '../bubble/reactors.model';
import { peerLabel } from '../../lib/peerProfiles';
import { useReconciledMap } from '../../lib/mapReconcile';
import { profileLinkOf } from '../../lib/links';
import { previewOf } from './feed-helpers';
import { replyQuoteOf } from './messageDeletion.model';
import { memberNamer, withMemberNames } from './systemNames.model';
import type { BubbleFeedState } from './bubbleModels';
import type { BubbleFeed } from './useFeedRenderItem';

export interface FeedActionTargets {
  onReact: (messageId: string, emoji: string) => void;
  setReplyTarget: (id: string, preview: string, sender?: string | null) => void;
  setMenuAnchor: (anchor: MenuAnchor) => void;
  setMenuFor: (entry: HistoryEntry | null) => void;
  jumpToMessage: (messageId: string) => void;
  onVote: (messageId: string, questionIndex: number, optionIndex: number, action: VoteAction) => void;
  onOpenAnswer: (messageId: string, questionIndex: number, text: string) => void;
  onSign: (requestId: string, req: SignatureRequestContent) => void;
  onPay: (requestId: string, wsc: WalletSendCallsContent) => void;
  setSelectedForCopy: (id: string | null) => void;
}

function useStableRecord<T extends object>(value: T): T {
  const previous = useRef(value);
  const before = previous.current as Record<string, unknown>;
  const next = value as Record<string, unknown>;
  const keys = Object.keys(next);
  const same = keys.length === Object.keys(before).length && keys.every((key) => before[key] === next[key]);
  if (!same) previous.current = value;
  return previous.current;
}

function makeFeedActions(
  targets: { current: FeedActionTargets },
  senderEthOf: { current: (from: string) => string | null },
  openProfile: (address: string) => void,
): FeedActions {
  const t = (): FeedActionTargets => targets.current;
  return {
    react: (entry, emoji) => {
      t().onReact(entry.id, emoji);
    },
    reply: (entry) => {
      t().setReplyTarget(entry.id, previewOf(entry), senderEthOf.current(entry.from));
    },
    openMenu: (entry, anchor) => {
      t().setMenuAnchor(anchor);
      t().setMenuFor(entry);
    },
    jumpToReply: (entry) => {
      if (entry.replyTo) t().jumpToMessage(entry.replyTo);
    },
    openProfile,
    vote: (entry, questionIndex, optionIndex, action) => {
      t().onVote(entry.id, questionIndex, optionIndex, action);
    },
    openAnswer: (entry, questionIndex, text) => {
      t().onOpenAnswer(entry.id, questionIndex, text);
    },
    sign: (entry) => {
      const req = signatureRequestOf(entry);
      if (req) t().onSign(entry.id, req);
    },
    pay: (entry) => {
      const wsc = walletSendCallsOf(entry);
      if (wsc) t().onPay(entry.id, wsc);
    },
    endSelection: () => {
      t().setSelectedForCopy(null);
    },
  };
}

function useFeedActions(targets: FeedActionTargets, senderEthOf: (from: string) => string | null): FeedActions {
  const router = useRouter();
  const latest = useRef(targets);
  latest.current = targets;
  const sender = useRef(senderEthOf);
  sender.current = senderEthOf;
  const navigator = useRef(router);
  navigator.current = router;
  const [actions] = useState(() =>
    makeFeedActions(latest, sender, (address) => {
      navigator.current.push(profileLinkOf(address));
    }),
  );
  return actions;
}

function useNamedEntry(myUri: string, senderEthOf: (from: string) => string | null): (item: HistoryEntry) => HistoryEntry {
  return useMemo(() => {
    const nameOf = memberNamer(inboxIdOfUri(myUri) || null, (inboxId) => senderEthOf(userUriOf(inboxId)));
    const cache = new WeakMap<HistoryEntry, HistoryEntry>();
    return (item: HistoryEntry): HistoryEntry => {
      const hit = cache.get(item);
      if (hit) return hit;
      const named = withMemberNames(item, nameOf);
      cache.set(item, named);
      return named;
    };
  }, [myUri, senderEthOf]);
}

function useReactorNames(
  reactions: Map<string, Map<string, string[]>>,
  myUri: string,
  addressOf: (uri: string) => string | null,
  profilesVersion: number,
): Map<string, Map<string, string[]>> {
  const named = useMemo(
    () => reactorNamesByMessage(reactions, myUri, reactorNamer(addressOf, peerLabel)),
    [reactions, myUri, addressOf, profilesVersion],
  );
  return useReconciledMap(named);
}

function useQuoteOf(
  events: readonly HistoryEntry[],
  deletedIds: BubbleFeedState['deletedIds'],
): (item: HistoryEntry) => string | undefined {
  return useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    return (item: HistoryEntry) => replyQuoteOf(item, deletedIds, (id) => byId.get(id));
  }, [events, deletedIds]);
}

export interface BubbleFeedInputs extends Omit<BubbleFeedState, 'namedEntry' | 'quoteOf' | 'reactorNames' | 'replyingToId' | 'menuForId'> {
  events: readonly HistoryEntry[];
  reactions: Map<string, Map<string, string[]>>;
  profilesVersion: number;
  replyingTo: { id: string } | null;
  menuFor: HistoryEntry | null;
}

export function useBubbleFeed(inputs: BubbleFeedInputs, targets: FeedActionTargets): BubbleFeed {
  const { events, reactions, profilesVersion, replyingTo, menuFor, ...rest } = inputs;
  const namedEntry = useNamedEntry(rest.myUri, rest.senderEthOf);
  const reactorNames = useReactorNames(reactions, rest.myUri, rest.senderEthOf, profilesVersion);
  const quoteOf = useQuoteOf(events, rest.deletedIds);
  const state = useStableRecord<BubbleFeedState>({
    ...rest,
    namedEntry,
    quoteOf,
    reactorNames,
    replyingToId: replyingTo?.id,
    menuForId: menuFor?.id,
  });
  const actions = useFeedActions(targets, rest.senderEthOf);
  return useMemo(() => ({ state, actions }), [state, actions]);
}
