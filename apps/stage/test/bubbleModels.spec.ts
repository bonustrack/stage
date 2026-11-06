import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { structuredPayload } from '@stage-labs/client/xmtp/entryPayload';
import { bubbleModelOf, reconcileBubbleModels, type BubbleFeedState } from '../components/conversation/bubbleModels';
import { bubbleHandlers, type FeedActions } from '../components/bubble/model';
import { mintLocalId } from '../components/composer/outbound';
import { entry } from './helpers';

const ME = 'xmtp:me';
const PEER = 'xmtp:peer';
const view = { dark: false };

function feedState(over: Partial<BubbleFeedState> = {}): BubbleFeedState {
  return {
    myUri: ME,
    consentAllowed: true,
    senderEthOf: (from) => (from === PEER ? '0xpeer' : null),
    namedEntry: (item) => item,
    quoteOf: (item) => (item.replyTo ? 'quoted' : undefined),
    deletedIds: new Map(),
    confirmedIds: new Map(),
    jumpHighlightId: null,
    selectedForCopy: null,
    reactorNames: new Map([['m1', new Map([['👍', ['You']]])]]),
    optimisticReactions: new Map(),
    optimisticRemovals: new Map(),
    ownReactions: new Map(),
    votes: new Map(),
    ownVotes: new Map(),
    openAnswers: new Map(),
    callRecords: new Map(),
    signingIds: new Set(),
    payingIds: new Set(),
    ...over,
  };
}

const theirs = entry('m1', { from: PEER, text: 'hi', replyTo: 'm0' });

describe('bubble model', () => {
  test('a live message carries its quote, reactions and sender', () => {
    const model = bubbleModelOf(theirs, feedState(), view);
    expect(model).toMatchObject({ senderEthAddress: '0xpeer', replyPreview: 'quoted', interactive: true, pending: false });
    expect(model.reactions?.get('👍')).toEqual(['You']);
  });

  test('a deleted message keeps no quote, reactions or actions', () => {
    const model = bubbleModelOf(theirs, feedState({ deletedIds: new Map([['m1', 'sender']]) }), view);
    expect([model.interactive, model.replyPreview, model.reactions]).toEqual([false, undefined, undefined]);
    const actions = {} as FeedActions;
    expect(Object.keys(bubbleHandlers(model, actions)).filter((k) => k.startsWith('onRe') || k === 'onOpenMenu')).toEqual([]);
  });

  test('a local id is pending until the network echo confirms it', () => {
    const id = mintLocalId();
    const sending = entry(id, { from: ME, text: 'x' });
    expect(bubbleModelOf(sending, feedState(), view).pending).toBe(true);
    expect(bubbleModelOf(sending, feedState({ confirmedIds: new Map([[id, 'real']]) }), view).pending).toBe(false);
  });

  test('the reply target, the jump highlight and the open menu mark the row', () => {
    for (const over of [{ replyingToId: 'm1' }, { jumpHighlightId: 'm1' }, { menuForId: 'm1' }]) {
      expect(bubbleModelOf(theirs, feedState(over), view).replyTarget).toBe(true);
    }
    expect(bubbleModelOf(theirs, feedState(), view).replyTarget).toBe(false);
  });

  test('only a request from someone else can be signed', () => {
    const request = structuredPayload('signatureRequest', { kind: 'personal', message: 'hello' });
    expect(bubbleModelOf(entry('s1', { from: PEER, payload: request }), feedState(), view).signable).toBe(true);
    expect(bubbleModelOf(entry('s2', { from: ME, payload: request }), feedState(), view).signable).toBe(false);
  });
});

describe('reconcileBubbleModels', () => {
  const items: HistoryEntry[] = [theirs, entry('m2', { from: ME, text: 'yo' })];
  const base = feedState();
  const build = (s: BubbleFeedState) => (item: HistoryEntry) => bubbleModelOf(item, s, view);

  test('keeps the same map and models when nothing a bubble shows changed', () => {
    const first = reconcileBubbleModels(new Map(), items, build(base));
    expect(reconcileBubbleModels(first, items, build({ ...base, selectedForCopy: 'other' }))).toBe(first);
  });

  test('replaces only the model that changed', () => {
    const first = reconcileBubbleModels(new Map(), items, build(base));
    const next = reconcileBubbleModels(first, items, build({ ...base, menuForId: 'm2' }));
    expect(next).not.toBe(first);
    expect(next.get('m1')).toBe(first.get('m1'));
    expect(next.get('m2')).not.toBe(first.get('m2'));
  });
});
