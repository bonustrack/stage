import { describe, expect, test } from 'bun:test';
import {
  applyInbound, applyRead, applyUnread, applySentPatch,
  type CachedChannelRow,
} from '../src/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS } from '../src/xmtp/summarizeRow';

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
  test('sets markedUnread and leaves the count and read marker alone', () => {
    expect(applyUnread(base, 'b')?.[1]).toEqual({ convId: 'b', unreadCount: 0, lastReadNs: 0, markedUnread: true, lastTs: 2 });
    expect(applyUnread(base, 'a')?.[0]?.unreadCount).toBe(3);
  });
  test('missing returns null', () => {
    expect(applyUnread(base, 'zzz')).toBeNull();
  });
});

describe('applySentPatch', () => {
  test('moves row to front, truncates preview, marks self', () => {
    const longPreview = 'x'.repeat(300);
    const out = applySentPatch(base, 'b', longPreview, 555);
    expect(out?.[0]?.convId).toBe('b');
    expect((out?.[0]?.lastPreview as string).length).toBe(ROW_PREVIEW_MAX_CHARS);
    expect(out?.[0]?.lastFromSelf).toBe(true);
    expect(out?.[0]?.lastTs).toBe(555);
    expect(out?.[1]?.convId).toBe('a');
  });
  test('missing returns null', () => {
    expect(applySentPatch(base, 'zzz', 'p', 1)).toBeNull();
  });
});

describe('applyInbound', () => {
  const rows = [{ ...base[1], convId: 'b', unreadCount: 0, lastReadNs: 0, lastTs: 2, lastPreview: '', selfInboxId: 'me' }];
  const update = { convId: 'b', senderInboxId: 'other', sentNs: 50, lastTs: 3, lastPreview: 'hi' };

  test('counts a new message from someone else', () => {
    expect(applyInbound(rows, update)?.next[0]?.unreadCount).toBe(1);
  });

  test('moves the row without counting a message that does not count as unread', () => {
    const out = applyInbound(rows, { ...update, lastPreview: 'added label "Blocked"', countsAsUnread: false });
    expect(out?.next[0]?.unreadCount).toBe(0);
    expect(out?.next[0]?.lastPreview).toBe('added label "Blocked"');
    expect(out?.wasUnread).toBe(false);
  });
});
