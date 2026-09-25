import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { mergeFeedEntries } from '../lib/feedOrder.model';

function entry(id: string, ts: string, text = id): HistoryEntry {
  return { id, ts, text, station: 'xmtp', line: 'metro://xmtp/a/c', from: 'u', to: 'c' };
}

const addedYou = entry('added-you', '2026-09-25T14:04:06.017Z');
const context = entry('context', '2026-09-25T14:04:08.999Z');
const inProgress = entry('in-progress', '2026-09-25T14:04:10.117Z');
const inReview = entry('in-review', '2026-09-25T14:21:56.467Z');
const fixPosted = entry('fix-posted', '2026-09-25T14:22:04.815Z');
const screenshot = entry('screenshot', '2026-09-25T14:22:04.949Z');

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
    const edited = entry('in-review', inReview.ts, 'edited');
    const merged = mergeFeedEntries([screenshot, inReview], [edited, screenshot, edited]);
    expect(merged.added).toBe(0);
    expect(merged.entries).toEqual([screenshot, inReview]);
    expect(mergeFeedEntries([], [context, context]).entries).toEqual([context]);
  });

  test('keeps a new message above one sent in the same millisecond', () => {
    const twin = entry('twin', fixPosted.ts);
    expect(ids(mergeFeedEntries([fixPosted, inReview], [twin]).entries)).toEqual(['twin', 'fix-posted', 'in-review']);
  });
});
