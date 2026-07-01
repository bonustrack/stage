import { describe, expect, test } from 'bun:test';
import { bubbleTimestamp, channelTimestamp, unreadBadgeLabel } from '../src/format';

describe('unreadBadgeLabel', () => {
  test('returns undefined when count is zero and not marked unread', () => {
    expect(unreadBadgeLabel(0)).toBeUndefined();
    expect(unreadBadgeLabel(0, false)).toBeUndefined();
  });

  test('returns the exact count as a string up to 99', () => {
    expect(unreadBadgeLabel(1)).toBe('1');
    expect(unreadBadgeLabel(99)).toBe('99');
  });

  test('caps at 99+ above 99', () => {
    expect(unreadBadgeLabel(100)).toBe('99+');
    expect(unreadBadgeLabel(1000)).toBe('99+');
  });

  test('shows a dot when marked unread with zero count', () => {
    expect(unreadBadgeLabel(0, true)).toBe('·');
  });

  test('count takes precedence over markedUnread', () => {
    expect(unreadBadgeLabel(2, true)).toBe('2');
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
