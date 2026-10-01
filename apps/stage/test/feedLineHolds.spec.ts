import { describe, expect, test } from 'bun:test';
import { activeFeedLines, holdFeedLine, resetFeedLines } from '../lib/feedLines';

describe('holdFeedLine', () => {
  test('a line stays active until its last holder lets go', () => {
    const first = holdFeedLine('line-a');
    const second = holdFeedLine('line-a');
    first();
    first();
    expect(activeFeedLines.has('line-a')).toBe(true);
    second();
    expect(activeFeedLines.has('line-a')).toBe(false);
  });

  test('a hold taken before a reset never releases a newer hold', () => {
    const stale = holdFeedLine('line-b');
    resetFeedLines();
    const fresh = holdFeedLine('line-b');
    stale();
    expect(activeFeedLines.has('line-b')).toBe(true);
    fresh();
    expect(activeFeedLines.has('line-b')).toBe(false);
  });
});
