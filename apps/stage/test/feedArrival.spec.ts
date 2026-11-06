import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { entry } from './helpers';
import { mockAppStorage } from './memoryStorage';

const resyncs: number[] = [];
const refreshed: string[] = [];
let latestPage: HistoryEntry[] = [];

mockAppStorage();
mock.module('../lib/xmtp.sdk', () => ({ sdk: {} }));
mock.module('../lib/xmtp.find', () => ({ convOfLine: async () => null }));
mock.module('../lib/xmtp.messages', () => ({ latestConvMessages: async () => [] }));
mock.module('../lib/feed/resync', () => ({
  syncInboxOnce: async () => undefined,
  refreshLatestPage: async (line: string) => {
    refreshed.push(line);
    return latestPage;
  },
  resyncActiveFeeds: async () => {
    resyncs.push(Date.now());
  },
}));

const { feedCache, feedGeneration, resetFeed } = await import('../lib/feed/cache');
const { holdFeedLine, isFeedLineActive } = await import('../lib/feed/lines');
const { onArrival, onDeletion, onUnknownArrival } = await import('../lib/feed/arrival');

const OPEN = 'stage://xmtp/open';
const OTHER = 'stage://xmtp/other';
const at = (minute: number): string => `2026-09-30T00:${String(minute).padStart(2, '0')}:00.000Z`;
const ns = (minute: number): number => Date.parse(at(minute)) * 1_000_000;

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

beforeEach(() => {
  resetFeed();
  resyncs.length = 0;
  refreshed.length = 0;
  latestPage = [];
});

describe('a message arriving from the stream', () => {
  test('lands in its feed without touching other open feeds when it is the newest', async () => {
    holdFeedLine(OPEN);
    onArrival(OPEN, entry('m1', { line: OPEN, ts: at(1) }), ns(1));
    await settle();
    expect(feedCache.get(OPEN)?.map((e) => e.id)).toEqual(['m1']);
    expect(refreshed).toEqual([]);
    expect(resyncs).toEqual([]);
  });

  test('heals its open feed when it is older than what the feed already shows', async () => {
    holdFeedLine(OPEN);
    onArrival(OPEN, entry('new', { line: OPEN, ts: at(5) }), ns(5));
    latestPage = [entry('new', { line: OPEN, ts: at(5) }), entry('late', { line: OPEN, ts: at(3) })];
    onArrival(OPEN, entry('late', { line: OPEN, ts: at(3) }), ns(3));
    await settle();
    expect(refreshed).toEqual([OPEN]);
    expect(feedCache.get(OPEN)?.map((e) => e.id)).toEqual(['new', 'late']);
  });

  test('in a chat that is not open resyncs the open feeds, since the stream may have skipped theirs', async () => {
    holdFeedLine(OPEN);
    onArrival(OTHER, entry('m1', { line: OTHER, ts: at(1) }), ns(1));
    await settle();
    expect(feedCache.get(OTHER)?.map((e) => e.id)).toEqual(['m1']);
    expect(resyncs.length).toBe(1);
  });

  test('with no open feed only fills the cache', async () => {
    onArrival(OTHER, entry('m1', { line: OTHER, ts: at(1) }), ns(1));
    await settle();
    expect(feedCache.get(OTHER)?.map((e) => e.id)).toEqual(['m1']);
    expect(resyncs).toEqual([]);
  });

  test('a control body never reaches a feed', async () => {
    holdFeedLine(OPEN);
    onArrival(OPEN, entry('ctrl', { line: OPEN, ts: at(1), text: 'METRO_CTRL:ping' }), ns(1));
    await settle();
    expect(feedCache.get(OPEN)).toBeUndefined();
  });

  test('without a conversation resyncs the open feeds, and nothing when none is open', async () => {
    onUnknownArrival();
    expect(resyncs).toEqual([]);
    holdFeedLine(OPEN);
    onUnknownArrival();
    expect(resyncs.length).toBe(1);
  });
});

describe('a deletion from the stream', () => {
  test('replaces a message the feed shows with its placeholder', async () => {
    onArrival(OPEN, entry('m1', { line: OPEN, ts: at(1) }), ns(1));
    const placeholder = entry('m1', { line: OPEN, ts: at(1), payload: { contentType: 'deletedMessage', deletedBy: 'sender' } });
    await onDeletion(
      OPEN,
      'm1',
      async () => placeholder,
      () => true,
    );
    expect(feedCache.get(OPEN)?.[0]).toBe(placeholder);
  });

  test('of a message the feed does not show does nothing', async () => {
    let asked = false;
    await onDeletion(
      OPEN,
      'unknown',
      async () => {
        asked = true;
        return null;
      },
      () => true,
    );
    expect(asked).toBe(false);
  });

  test('resyncs an open feed when the placeholder cannot be read', async () => {
    holdFeedLine(OPEN);
    onArrival(OPEN, entry('m1', { line: OPEN, ts: at(1) }), ns(1));
    await onDeletion(
      OPEN,
      'm1',
      async () => null,
      () => true,
    );
    expect(resyncs.length).toBe(1);
  });

  test('is dropped when the account or the feed changed while the placeholder loaded', async () => {
    onArrival(OPEN, entry('m1', { line: OPEN, ts: at(1) }), ns(1));
    const placeholder = entry('m1', { line: OPEN, ts: at(1), payload: { contentType: 'deletedMessage', deletedBy: 'sender' } });
    await onDeletion(
      OPEN,
      'm1',
      async () => placeholder,
      () => false,
    );
    expect(feedCache.get(OPEN)?.[0]?.payload).toBeUndefined();
    const resetting = onDeletion(
      OPEN,
      'm1',
      async () => {
        resetFeed();
        return placeholder;
      },
      () => true,
    );
    await resetting;
    expect(feedCache.get(OPEN)).toBeUndefined();
  });
});

describe('the feed generation', () => {
  test('a generation taken before a reset is stale after it, and the reset closes every feed', () => {
    holdFeedLine(OPEN);
    const before = feedGeneration();
    expect(before.current()).toBe(true);
    resetFeed();
    expect(before.current()).toBe(false);
    expect(feedGeneration().current()).toBe(true);
    expect(isFeedLineActive(OPEN)).toBe(false);
  });
});
