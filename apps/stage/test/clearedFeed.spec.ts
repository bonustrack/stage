import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { entriesAfterClear, feedReachedClear } from '../components/conversation/feed-helpers';

const at = (ms: number, id: string): HistoryEntry => ({
  id, ts: new Date(ms).toISOString(), station: 'xmtp', line: 'l', from: 'a', to: 'b',
});

describe('deleted chat feed', () => {
  const feed = [at(1000, 'old'), at(2000, 'edge'), at(3000, 'new')];

  test('only messages after the deletion are shown', () => {
    expect(entriesAfterClear(feed, 2000).map(e => e.id)).toEqual(['new']);
    expect(entriesAfterClear(feed, undefined)).toBe(feed);
  });

  test('paging stops once the loaded history reaches the deletion', () => {
    expect(feedReachedClear(feed, 2000)).toBe(true);
    expect(feedReachedClear([at(3000, 'new')], 2000)).toBe(false);
    expect(feedReachedClear(feed, undefined)).toBe(false);
  });
});
