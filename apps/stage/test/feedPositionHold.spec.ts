import { describe, expect, test } from 'bun:test';
import { feedPositionHold } from '../components/conversation/feed-helpers';

const FOLLOW_WITHIN = 24;

describe('the native feed follows new messages unless the reader has scrolled back', () => {
  test('resting on the newest message leaves the list free to follow a new row', () => {
    expect(feedPositionHold(false, false, FOLLOW_WITHIN)).toBeUndefined();
  });

  test('reading older messages holds the visible row in place', () => {
    expect(feedPositionHold(false, true, FOLLOW_WITHIN)).toEqual({
      minIndexForVisible: 0, autoscrollToTopThreshold: FOLLOW_WITHIN,
    });
  });
});

describe('the web feed keeps its anchor for older pages wherever the reader is', () => {
  test('at the newest message', () => {
    expect(feedPositionHold(true, false, FOLLOW_WITHIN)).toEqual({ minIndexForVisible: 0 });
  });

  test('while reading older messages', () => {
    expect(feedPositionHold(true, true, FOLLOW_WITHIN)).toEqual({ minIndexForVisible: 0 });
  });
});
