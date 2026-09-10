import { describe, expect, test } from 'bun:test';
import {
  formatHistoryPin, historyPinFromRandom, historySyncIsActive, historySyncPhaseLabel,
  isValidHistoryPin, normalizeHistoryPin,
} from '../lib/historySync.model';

describe('history pin', () => {
  test('derives six digits from random bytes', () => {
    expect(historyPinFromRandom(new Uint8Array([10, 21, 32, 43, 54, 65, 76]))).toBe('012345');
  });

  test('pads a short byte source', () => {
    expect(historyPinFromRandom(new Uint8Array([9, 9]))).toBe('990000');
  });

  test('normalizes and validates typed pins', () => {
    expect(normalizeHistoryPin(' 483 920 ')).toBe('483920');
    expect(isValidHistoryPin('483920')).toBe(true);
    expect(isValidHistoryPin('48392')).toBe(false);
    expect(isValidHistoryPin('48392a')).toBe(false);
  });

  test('formats a pin in two groups', () => {
    expect(formatHistoryPin('483920')).toBe('483 920');
  });
});

describe('history sync phases', () => {
  test('idle has no label and only the two pending phases are active', () => {
    expect(historySyncPhaseLabel('idle')).toBeNull();
    expect(historySyncPhaseLabel('waiting')).toContain('other device');
    expect(historySyncIsActive('requesting')).toBe(true);
    expect(historySyncIsActive('waiting')).toBe(true);
    expect(historySyncIsActive('done')).toBe(false);
  });
});
