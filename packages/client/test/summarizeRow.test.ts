import { describe, expect, test } from 'bun:test';
import {
  channelRowTitle,
  countUnreadEntries,
  initialMarkedUnread,
} from '../src/xmtp/summarizeRow';

describe('countUnreadEntries', () => {
  const e = (sentNs: number | undefined, sender: string): { sentNs?: number; senderInboxId: string } =>
    ({ sentNs, senderInboxId: sender });

  test('counts newest-first entries above lastReadNs, skipping self', () => {
    const entries = [e(300, 'other'), e(250, 'me'), e(200, 'other'), e(100, 'other')];
    expect(countUnreadEntries(entries, 150, 'me')).toBe(2);
  });

  test('stops at first read or missing timestamp', () => {
    expect(countUnreadEntries([e(undefined, 'other'), e(300, 'other')], 0, 'me')).toBe(0);
    expect(countUnreadEntries([e(100, 'other')], 100, 'me')).toBe(0);
  });
});

describe('channelRowTitle', () => {
  test('peer address short form wins', () => {
    const title = channelRowTitle({
      peerAddress: '0x1234567890abcdef1234567890abcdef12345678',
      groupName: 'Team', memberCount: 3, fallbackId: 'conv',
    });
    expect(title).toContain('0x1234');
  });

  test('trimmed group name, then member count, then fallback id slice', () => {
    const base = { peerAddress: null, memberCount: 0, fallbackId: 'abcdefghijklmnop' };
    expect(channelRowTitle({ ...base, groupName: '  Team  ' })).toBe('Team');
    expect(channelRowTitle({ ...base, groupName: ' ', memberCount: 2 })).toBe('3 members');
    expect(channelRowTitle({ ...base, groupName: '' })).toBe('abcdefghijkl');
  });
});

describe('initialMarkedUnread', () => {
  const base = { lastReadNs: 0, unreadCount: 0, hasLast: true, lastFromSelf: false };

  test('true for fresh unread-eligible rows, consent defaulting to unknown', () => {
    expect(initialMarkedUnread(base)).toBe(true);
    expect(initialMarkedUnread({ ...base, consentUnknown: true })).toBe(true);
  });

  test('false when consent known, read, counted, self, or empty', () => {
    expect(initialMarkedUnread({ ...base, consentUnknown: false })).toBe(false);
    expect(initialMarkedUnread({ ...base, lastReadNs: 5 })).toBe(false);
    expect(initialMarkedUnread({ ...base, unreadCount: 1 })).toBe(false);
    expect(initialMarkedUnread({ ...base, lastFromSelf: true })).toBe(false);
    expect(initialMarkedUnread({ ...base, hasLast: false })).toBe(false);
  });
});
