import { describe, expect, test } from 'bun:test';
import {
  applyRead, applyUnread, applyConsent, applySentPatch,
  type CachedChannelRow,
} from '../src/xmtp/channelsCache';

interface Row extends CachedChannelRow {
  lastTs?: number;
  lastPreview?: string;
  lastFromSelf?: boolean;
}

const base: Row[] = [
  { convId: 'a', unreadCount: 3, lastReadNs: 100, markedUnread: true, lastTs: 1 },
  { convId: 'b', unreadCount: 0, lastReadNs: 0, lastTs: 2 },
];

describe('applyRead', () => {
  test('zeros unread, sets lastReadNs, clears markedUnread, keeps order', () => {
    const out = applyRead(base, 'a', 999);
    expect(out).not.toBeNull();
    expect(out?.[0]).toEqual({ convId: 'a', unreadCount: 0, lastReadNs: 999, markedUnread: false, lastTs: 1 });
    expect(out?.[1]).toBe(base[1]);
  });
  test('missing conv returns null', () => {
    expect(applyRead(base, 'zzz', 1)).toBeNull();
  });
});

describe('applyUnread', () => {
  test('forces unreadCount>=1, lastReadNs 0, markedUnread true', () => {
    expect(applyUnread(base, 'b')?.[1]).toEqual({ convId: 'b', unreadCount: 1, lastReadNs: 0, markedUnread: true, lastTs: 2 });
    expect(applyUnread(base, 'a')?.[0]?.unreadCount).toBe(3);
  });
  test('missing returns null', () => {
    expect(applyUnread(base, 'zzz')).toBeNull();
  });
});

describe('applyConsent', () => {
  test('no-op when state already matches returns null', () => {
    expect(applyConsent(base, 'a', true)).toBeNull();
  });
  test('to unknown sets markedUnread + min unread', () => {
    expect(applyConsent(base, 'b', true)?.[1]).toEqual({ convId: 'b', unreadCount: 1, lastReadNs: 0, markedUnread: true, lastTs: 2 });
  });
  test('to allowed clears markedUnread + unread', () => {
    expect(applyConsent(base, 'a', false)?.[0]).toEqual({ convId: 'a', unreadCount: 0, lastReadNs: 100, markedUnread: false, lastTs: 1 });
  });
});

describe('applySentPatch', () => {
  test('moves row to front, truncates preview, marks self', () => {
    const longPreview = 'x'.repeat(200);
    const out = applySentPatch(base, 'b', longPreview, 555);
    expect(out?.[0]?.convId).toBe('b');
    expect((out?.[0]?.lastPreview as string).length).toBe(80);
    expect(out?.[0]?.lastFromSelf).toBe(true);
    expect(out?.[0]?.lastTs).toBe(555);
    expect(out?.[1]?.convId).toBe('a');
  });
  test('missing returns null', () => {
    expect(applySentPatch(base, 'zzz', 'p', 1)).toBeNull();
  });
});
