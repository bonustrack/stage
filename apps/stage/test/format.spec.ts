import { describe, expect, test } from 'bun:test';
import { bubbleTimestamp, channelTimestamp, timeAgo, unreadBadgeLabel } from '../lib/format';

describe('unreadBadgeLabel', () => {
  test('returns undefined when count is zero', () => {
    expect(unreadBadgeLabel(0)).toBeUndefined();
  });

  test('returns the exact count as a string up to 99', () => {
    expect(unreadBadgeLabel(1)).toBe('1');
    expect(unreadBadgeLabel(99)).toBe('99');
  });

  test('caps at 99+ above 99', () => {
    expect(unreadBadgeLabel(100)).toBe('99+');
    expect(unreadBadgeLabel(1000)).toBe('99+');
  });
});

describe('channelTimestamp', () => {
  test('returns empty string for null', () => {
    expect(channelTimestamp(null)).toBe('');
  });

  test('returns empty string for zero', () => {
    expect(channelTimestamp(0)).toBe('');
  });
});

describe('bubbleTimestamp', () => {
  test('does not throw on a malformed string and reports the invalid date', () => {
    expect(bubbleTimestamp('bad-timestamp')).toBe('Invalid Date');
  });

  test('formats a valid ISO string as a HH:mm clock time', () => {
    expect(bubbleTimestamp('2024-05-04T10:20:30Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('timeAgo', () => {
  const NOW = Date.parse('2026-09-24T12:00:00Z');

  test('rounds to the largest unit', () => {
    expect(timeAgo('2026-09-24T11:59:30Z', NOW)).toBe('just now');
    expect(timeAgo('2026-09-24T11:15:00Z', NOW)).toBe('45m ago');
    expect(timeAgo('2026-09-24T09:00:00Z', NOW)).toBe('3h ago');
    expect(timeAgo('2026-09-21T12:00:00Z', NOW)).toBe('3d ago');
  });

  test('an unknown or invalid time gives an empty label', () => {
    expect(timeAgo('', NOW)).toBe('');
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});
