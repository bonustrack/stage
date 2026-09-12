import { describe, expect, test } from 'bun:test';
import {
  fingerprintOf, formatHistoryPin, historyGrewOlder, historyPinFromRandom, historySyncIsActive, historySyncPhaseLabel,
  holdsHistoryBefore, isValidHistoryPin, normalizeHistoryPin, snapshotOf,
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
    expect(historySyncPhaseLabel('waiting', '0x12…34')).toContain('0x12…34');
    expect(historySyncIsActive('requesting')).toBe(true);
    expect(historySyncIsActive('waiting')).toBe(true);
    expect(historySyncIsActive('done')).toBe(false);
  });
});

describe('fingerprintOf', () => {
  test('is order independent and changes when an older message appears', () => {
    const before = fingerprintOf([{ id: 'b', firstNs: '200' }, { id: 'a', firstNs: '100' }]);
    expect(before).toBe(fingerprintOf([{ id: 'a', firstNs: '100' }, { id: 'b', firstNs: '200' }]));
    expect(fingerprintOf([{ id: 'a', firstNs: '50' }, { id: 'b', firstNs: '200' }])).not.toBe(before);
    expect(fingerprintOf([{ id: 'a', firstNs: '100' }, { id: 'b', firstNs: '200' }, { id: 'c', firstNs: '' }])).not.toBe(before);
  });
});

describe('history snapshot', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const installedAtMs = 1_700_000_000_000;
  const ns = (ms: number): string => String(ms * 1_000_000);

  test('finds the oldest message and ignores empty conversations', () => {
    const snap = snapshotOf([{ id: 'a', firstNs: ns(installedAtMs) }, { id: 'b', firstNs: '' }, { id: 'c', firstNs: ns(installedAtMs - dayMs) }]);
    expect(snap.oldestNs).toBe((installedAtMs - dayMs) * 1_000_000);
    expect(snapshotOf([{ id: 'b', firstNs: '' }]).oldestNs).toBeNull();
  });

  test('history older than the install, beyond clock skew, counts as arrived', () => {
    expect(holdsHistoryBefore(snapshotOf([{ id: 'a', firstNs: ns(installedAtMs - dayMs) }]), installedAtMs)).toBe(true);
    expect(holdsHistoryBefore(snapshotOf([{ id: 'a', firstNs: ns(installedAtMs - 60_000) }]), installedAtMs)).toBe(false);
    expect(holdsHistoryBefore(snapshotOf([{ id: 'a', firstNs: ns(installedAtMs + 1) }]), installedAtMs)).toBe(false);
    expect(holdsHistoryBefore(snapshotOf([]), installedAtMs)).toBe(false);
  });
});

describe('historyGrewOlder', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const startedAtMs = 1_700_000_000_000;
  const ns = (ms: number): string => String(ms * 1_000_000);
  const baseline = snapshotOf([{ id: 'a', firstNs: ns(startedAtMs - 60_000) }, { id: 'b', firstNs: '' }]);

  test('a known conversation whose first message moved earlier counts as history', () => {
    expect(historyGrewOlder(baseline, snapshotOf([{ id: 'a', firstNs: ns(startedAtMs - dayMs) }]), startedAtMs)).toBe(true);
  });

  test('a welcome for a new conversation with only fresh messages does not', () => {
    const current = snapshotOf([{ id: 'a', firstNs: ns(startedAtMs - 60_000) }, { id: 'c', firstNs: ns(startedAtMs + 2_000) }]);
    expect(historyGrewOlder(baseline, current, startedAtMs)).toBe(false);
  });

  test('a new conversation carrying messages from before the watch does', () => {
    const current = snapshotOf([{ id: 'c', firstNs: ns(startedAtMs - dayMs) }]);
    expect(historyGrewOlder(baseline, current, startedAtMs)).toBe(true);
  });

  test('an unchanged snapshot or a first message for an empty conversation is not history', () => {
    expect(historyGrewOlder(baseline, baseline, startedAtMs)).toBe(false);
    const current = snapshotOf([{ id: 'a', firstNs: ns(startedAtMs - 60_000) }, { id: 'b', firstNs: ns(startedAtMs + 1) }]);
    expect(historyGrewOlder(baseline, current, startedAtMs)).toBe(false);
  });
});
