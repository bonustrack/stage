import { describe, expect, test } from 'bun:test';
import { bubbleShift } from '../lib/railTooltip';

describe('tooltip bubble stays on screen', () => {
  test('no shift when it fits', () => {
    expect(bubbleShift(500, 100, 1000, 8)).toBe(0);
  });
  test('shifts left near the right edge and right near the left edge', () => {
    expect(bubbleShift(980, 100, 1000, 8)).toBe(-38);
    expect(bubbleShift(20, 100, 1000, 8)).toBe(38);
  });
});
