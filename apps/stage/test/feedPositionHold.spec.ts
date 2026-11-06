import { describe, expect, test } from 'bun:test';
import { feedOrientation as inverted } from '../components/conversation/feedOrientation';
import { feedOrientation as upright } from '../components/conversation/feedOrientation.web';
import { FOLLOW_NEWEST_WITHIN_PX } from '../components/conversation/feedOrientation.core';

describe('the native feed follows new messages unless the reader has scrolled back', () => {
  test('resting on the newest message leaves the list free to follow a new row', () => {
    expect(inverted.positionHold(false)).toBeUndefined();
  });

  test('reading older messages holds the visible row in place', () => {
    expect(inverted.positionHold(true)).toEqual({ minIndexForVisible: 0, autoscrollToTopThreshold: FOLLOW_NEWEST_WITHIN_PX });
  });
});

describe('the web feed keeps its anchor for older pages wherever the reader is', () => {
  test('at the newest message', () => {
    expect(upright.positionHold(false)).toEqual({ minIndexForVisible: 0 });
  });

  test('while reading older messages', () => {
    expect(upright.positionHold(true)).toEqual({ minIndexForVisible: 0 });
  });
});
