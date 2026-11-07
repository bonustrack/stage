import { describe, expect, test } from 'bun:test';
import { applyInbound } from '../src/xmtp/channelsCache';
import { channelRow } from './helpers';

const update = { senderInboxId: 'other', sentNs: 100, lastTs: 5, lastPreview: 'hi' };

describe('applyInbound', () => {
  test('bumps matching row to front with unread increment', () => {
    const rows = [channelRow('a'), channelRow('b', { unreadCount: 1 })];
    const result = applyInbound(rows, { ...update, convId: 'b' });
    expect(result).not.toBeNull();
    expect(result?.next.map((r) => r.convId)).toEqual(['b', 'a']);
    expect(result?.next[0]?.unreadCount).toBe(2);
    expect(result?.next[0]?.lastPreview).toBe('hi');
    expect(result?.next[0]?.markedUnread).toBe(false);
    expect(result?.wasUnread).toBe(true);
    expect(result?.current.unreadCount).toBe(1);
  });

  test('own messages do not increment unread', () => {
    const rows = [channelRow('a', { unreadCount: 3 })];
    const result = applyInbound(rows, { ...update, convId: 'a', senderInboxId: 'me' });
    expect(result?.next[0]?.unreadCount).toBe(3);
    expect(result?.wasUnread).toBe(false);
  });

  test('already-read messages do not increment unread', () => {
    const rows = [channelRow('a', { lastReadNs: 200 })];
    const result = applyInbound(rows, { ...update, convId: 'a' });
    expect(result?.next[0]?.unreadCount).toBe(0);
    expect(result?.wasUnread).toBe(false);
  });

  test('missing row or null convId returns null', () => {
    const rows = [channelRow('a')];
    expect(applyInbound(rows, { ...update, convId: 'zzz' })).toBeNull();
    expect(applyInbound(rows, { ...update, convId: null })).toBeNull();
  });

  test('patch merges platform fields from the pre-update row', () => {
    const rows = [{ ...channelRow('a'), peer: '0x1' }];
    const result = applyInbound(rows, { ...update, convId: 'a' }, (cur) => ({ lastSenderAddress: cur.peer }));
    expect(result?.next[0]?.lastSenderAddress).toBe('0x1');
  });
});
