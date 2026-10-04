import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { mergeFeedEntries, settleCachedFeed, withNestedReactions } from '../lib/feedOrder.model';
import { entry } from './helpers';

const addedYou = entry('added-you', { ts: '2026-09-25T14:04:06.017Z' });
const context = entry('context', { ts: '2026-09-25T14:04:08.999Z' });
const inProgress = entry('in-progress', { ts: '2026-09-25T14:04:10.117Z' });
const inReview = entry('in-review', { ts: '2026-09-25T14:21:56.467Z' });
const fixPosted = entry('fix-posted', { ts: '2026-09-25T14:22:04.815Z' });
const screenshot = entry('screenshot', { ts: '2026-09-25T14:22:04.949Z' });

const ids = (entries: readonly HistoryEntry[]): string[] => entries.map(e => e.id);

describe('feed merge order', () => {
  test('puts messages that sync late below the newer ones the stream already delivered', () => {
    const streamed = [screenshot, fixPosted, inReview];
    const latestPage = [screenshot, fixPosted, inReview, inProgress, context, addedYou];
    const merged = mergeFeedEntries(streamed, latestPage);
    expect(ids(merged.entries)).toEqual(['screenshot', 'fix-posted', 'in-review', 'in-progress', 'context', 'added-you']);
    expect(merged.added).toBe(3);
  });

  test('places a streamed message by when it was sent, not when it arrived', () => {
    const merged = mergeFeedEntries([screenshot, inReview, context], [fixPosted]);
    expect(ids(merged.entries)).toEqual(['screenshot', 'fix-posted', 'in-review', 'context']);
  });

  test('adds an older page at the old end and heals a slice that was out of order', () => {
    const merged = mergeFeedEntries([inProgress, screenshot, inReview], [context, addedYou]);
    expect(ids(merged.entries)).toEqual(['screenshot', 'in-review', 'in-progress', 'context', 'added-you']);
  });

  test('keeps the entry already in the feed and counts only new ones', () => {
    const edited = entry('in-review', { ts: inReview.ts, text: 'edited' });
    const merged = mergeFeedEntries([screenshot, inReview], [edited, screenshot, edited]);
    expect(merged.added).toBe(0);
    expect(merged.entries).toEqual([screenshot, inReview]);
    expect(mergeFeedEntries([], [context, context]).entries).toEqual([context]);
  });

  test('keeps a new message above one sent in the same millisecond', () => {
    const twin = entry('twin', { ts: fixPosted.ts });
    expect(ids(mergeFeedEntries([fixPosted, inReview], [twin]).entries)).toEqual(['twin', 'fix-posted', 'in-review']);
  });

  test('keeps a reaction stamped before its message above it, so the feed still ends on its oldest message', () => {
    const early = entry('early', { ts: '2026-09-25T13:58:00.000Z', payload: { reactTo: 'in-progress', emoji: '+1' } });
    const firstPage = mergeFeedEntries([fixPosted], [inReview, early, inProgress]);
    expect(ids(firstPage.entries)).toEqual(['fix-posted', 'in-review', 'early', 'in-progress']);
    const olderPage = mergeFeedEntries(firstPage.entries, [context, addedYou]);
    expect(ids(olderPage.entries)).toEqual(['fix-posted', 'in-review', 'early', 'in-progress', 'context', 'added-you']);
    expect(ids(mergeFeedEntries([inReview, early], [inProgress]).entries)).toEqual(['in-review', 'early', 'in-progress']);
  });

  test('flags a channel update only when a new system line arrives', () => {
    const labeled = entry('labeled', { ts: '2026-09-25T14:23:00.000Z', payload: { system: true } });
    expect(mergeFeedEntries([fixPosted], [labeled, fixPosted]).channelUpdated).toBe(true);
    expect(mergeFeedEntries([labeled, fixPosted], [labeled, screenshot]).channelUpdated).toBe(false);
    expect(mergeFeedEntries([fixPosted], [screenshot]).channelUpdated).toBe(false);
  });

  test('a fresh page replaces the cached messages it does not confirm and keeps live ones', () => {
    const cachedOld = entry('in-review', { ts: inReview.ts, text: 'cached copy' });
    const deletedSince = entry('deleted-since', { ts: '2026-09-25T14:21:00.000Z' });
    const cached = new Set(['in-review', 'deleted-since', 'context']);
    const slice = [screenshot, cachedOld, deletedSince, context];
    const settled = settleCachedFeed(slice, cached, [fixPosted, inReview, inProgress]);
    expect(ids(settled.entries)).toEqual(['screenshot', 'fix-posted', 'in-review', 'in-progress']);
    expect(settled.entries[2]).toBe(inReview);
    expect(ids(settleCachedFeed(slice, cached, []).entries)).toEqual(['screenshot']);
  });
});

interface Msg { id: string; ns: number; reactions: Msg[] }

const msg = (id: string, ns: number, reactions: Msg[] = []): Msg => ({ id, ns, reactions });
const reactionIds = (list: Msg[]): string[] => list.map((m) => m.id);
const expand = (list: Msg[]): Msg[] => withNestedReactions(list, (m) => m.reactions, (m) => m.ns);

describe('nested reactions in a history page', () => {
  test('lists every reaction a message carries, including removals', () => {
    const page = [
      msg('m2', 20, [msg('add-m2', 25)]),
      msg('m1', 10, [msg('add-m1', 30), msg('remove-m1', 40)]),
    ];
    expect(reactionIds(expand(page)).sort()).toEqual(['add-m1', 'add-m2', 'm1', 'm2', 'remove-m1']);
  });

  test('orders reactions and messages newest first across the page', () => {
    const page = [
      msg('m3', 30),
      msg('m2', 20, [msg('r25', 25), msg('r45', 45)]),
      msg('m1', 10, [msg('r35', 35)]),
    ];
    expect(reactionIds(expand(page))).toEqual(['r45', 'r35', 'm3', 'r25', 'm2', 'm1']);
  });

  test('keeps a reaction stamped before its message ahead of it, so the page still ends on its oldest message', () => {
    const page = [msg('m2', 20), msg('m1', 10, [msg('early', 5)])];
    expect(reactionIds(expand(page))).toEqual(['m2', 'early', 'm1']);
  });
});
