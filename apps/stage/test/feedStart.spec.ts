import { describe, expect, test } from 'bun:test';
import { FEED_START_LIMIT, feedStartOf, isAtFeedStart, parseFeedStarts, withFeedStart, type FeedStart } from '../lib/feedStart.model';

describe('feed start memory', () => {
  test('keeps one first message per chat and only the most recent chats', () => {
    expect(withFeedStart([['a', 'm1']], 'a', 'm2')).toEqual([['a', 'm2']]);
    const full = Array.from({ length: FEED_START_LIMIT }, (_, i): FeedStart => [`l${i}`, `m${i}`]);
    expect(withFeedStart(full, 'c', 'm3')).toEqual([...full.slice(1), ['c', 'm3']]);
    expect(feedStartOf([['a', 'm1'], ['b', 'm2']], 'b')).toBe('m2');
    expect(feedStartOf([['a', 'm1']], 'b')).toBeUndefined();
  });

  test('is at the start only while the oldest loaded message is the first one', () => {
    expect(isAtFeedStart('m1', 'm1')).toBe(true);
    expect(isAtFeedStart('m9', 'm1')).toBe(false);
    expect(isAtFeedStart('m1', undefined)).toBe(false);
    expect(isAtFeedStart(undefined, '')).toBe(true);
    expect(isAtFeedStart('m1', '')).toBe(false);
  });

  test('reads stored pairs and drops the old per-chat flags', () => {
    expect(parseFeedStarts('[["a","m1"],["b",2],"c"]')).toEqual([['a', 'm1']]);
    expect(parseFeedStarts('["stage://xmtp/abc"]')).toEqual([]);
    expect(parseFeedStarts('{"a":1}')).toBeUndefined();
    expect(parseFeedStarts('not json')).toBeUndefined();
  });
});
