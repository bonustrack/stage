import { describe, expect, test } from 'bun:test';
import {
  hasOpenFeeds,
  holdFeedLine,
  isFeedLineActive,
  isFeedLoaded,
  markFeedLoaded,
  openFeedLines,
  resetFeedLines,
} from '../lib/feed/lines';

describe('holdFeedLine', () => {
  test('a line stays active until its last holder lets go', () => {
    const first = holdFeedLine('line-a');
    const second = holdFeedLine('line-a');
    first();
    first();
    expect(isFeedLineActive('line-a')).toBe(true);
    second();
    expect(isFeedLineActive('line-a')).toBe(false);
  });

  test('a hold taken before a reset never releases a newer hold', () => {
    const stale = holdFeedLine('line-b');
    resetFeedLines();
    const fresh = holdFeedLine('line-b');
    stale();
    expect(isFeedLineActive('line-b')).toBe(true);
    fresh();
    expect(isFeedLineActive('line-b')).toBe(false);
  });

  test('a line counts as loaded only after its first page, until a reset', () => {
    expect(isFeedLoaded('line-c')).toBe(false);
    markFeedLoaded('line-c');
    expect(isFeedLoaded('line-c')).toBe(true);
    resetFeedLines();
    expect(isFeedLoaded('line-c')).toBe(false);
  });

  test('open feeds are the held lines, and none stay open after a reset', () => {
    resetFeedLines();
    expect(hasOpenFeeds()).toBe(false);
    const release = holdFeedLine('line-d');
    holdFeedLine('line-e');
    expect(hasOpenFeeds()).toBe(true);
    expect([...openFeedLines()]).toEqual(['line-d', 'line-e']);
    release();
    expect([...openFeedLines()]).toEqual(['line-e']);
    resetFeedLines();
    expect(hasOpenFeeds()).toBe(false);
  });
});
