import { describe, expect, test } from 'bun:test';
import {
  applyGroupMeta,
  applyInbound,
  applyRead,
  applyReadUpTo,
  applyUnread,
  applySentPatch,
  normalizeChannelRowTitle,
  type ChannelRow,
  type GroupRowMeta,
} from '../src/xmtp/channelsCache';
import { ROW_PREVIEW_MAX_CHARS } from '../src/xmtp/summarizeRow';
import { channelRow } from './helpers';

const rowA = channelRow('a', { unreadCount: 3, lastReadNs: 100, markedUnread: true, lastTs: 1 });
const rowB = channelRow('b', { lastTs: 2 });
const base: ChannelRow[] = [rowA, rowB];

describe('normalizeChannelRowTitle', () => {
  const row = channelRow('a', { groupName: '', title: 'proto', selfInboxId: 'self' });

  test('normalizes known group metadata before the row is published or searched', () => {
    expect(normalizeChannelRowTitle(row).title).toBe('Untitled channel');
    expect(normalizeChannelRowTitle({ ...row, inboxToAddr: { self: '0xself', other: '0xother', unresolved: '' } }).title).toBe('2 members');
    expect(normalizeChannelRowTitle({ ...row, groupName: '  Edited title  ' }).title).toBe('Edited title');
    expect(normalizeChannelRowTitle({ ...row, groupName: 'proto' }).title).toBe('proto');
    expect(row.title).toBe('proto');
  });

  test('keeps direct chats, unknown legacy names and unchanged row identities', () => {
    const dm = { ...row, peerAddress: '0xpeer', title: 'Direct chat' };
    const legacy = { ...row, groupName: undefined, title: 'Legacy name' };
    const unchanged = { ...row, title: 'Untitled channel' };
    expect(normalizeChannelRowTitle(dm)).toBe(dm);
    expect(normalizeChannelRowTitle(legacy)).toBe(legacy);
    expect(normalizeChannelRowTitle(unchanged)).toBe(unchanged);
  });
});

describe('applyRead', () => {
  test('zeros unread, sets lastReadNs, clears markedUnread, keeps order', () => {
    const out = applyRead(base, 'a', 999);
    expect(out).not.toBeNull();
    expect(out?.[0]).toEqual({ ...rowA, unreadCount: 0, lastReadNs: 999, markedUnread: false });
    expect(out?.[1]).toBe(rowB);
  });
  test('missing conv returns null', () => {
    expect(applyRead(base, 'zzz', 1)).toBeNull();
  });
});

describe('applyReadUpTo', () => {
  const row = channelRow('a', { unreadCount: 1, lastReadNs: 5_000_000, markedUnread: true, lastTs: 9 });
  const rows = [row];
  test('a read older than the last message keeps the unread count', () => {
    expect(applyReadUpTo(rows, 'a', 7_000_000)?.[0]).toEqual({ ...row, lastReadNs: 7_000_000, markedUnread: false });
  });
  test('a read that covers the last message zeros the count', () => {
    expect(applyReadUpTo(rows, 'a', 9_000_000)?.[0]?.unreadCount).toBe(0);
  });
  test('never moves the read marker back', () => {
    expect(applyReadUpTo(rows, 'a', 1_000_000)?.[0]?.lastReadNs).toBe(5_000_000);
  });
  test('missing conv returns null', () => {
    expect(applyReadUpTo(rows, 'zzz', 1)).toBeNull();
  });
});

describe('applyUnread', () => {
  test('sets markedUnread and leaves the count and read marker alone', () => {
    expect(applyUnread(base, 'b')?.[1]).toEqual({ ...rowB, markedUnread: true });
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
    expect(out?.[0]?.lastPreview.length).toBe(ROW_PREVIEW_MAX_CHARS);
    expect(out?.[0]?.lastFromSelf).toBe(true);
    expect(out?.[0]?.lastTs).toBe(555);
    expect(out?.[1]?.convId).toBe('a');
  });
  test('missing returns null', () => {
    expect(applySentPatch(base, 'zzz', 'p', 1)).toBeNull();
  });
});

describe('applyInbound', () => {
  const rows = [rowB];
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

describe('applyGroupMeta', () => {
  const meta: GroupRowMeta = {
    title: 'Ops',
    avatarUri: null,
    avatarAddress: 'seed',
    labels: ['Todo'],
    category: null,
    status: null,
    priority: null,
    assigned: [],
  };
  const metaRow = channelRow('a', { unreadCount: 2, lastReadNs: 7, lastTs: 9, lastPreview: 'hi', ...meta });
  const rows = [metaRow, rowB];

  test.each<[string, Partial<GroupRowMeta>]>([
    ['labels', { labels: ['In progress'] }],
    ['real group name', { groupName: 'Ops' }],
    ['added label', { labels: ['Todo', 'Blocked'] }],
    ['cleared labels', { labels: [] }],
    ['title', { title: 'Renamed' }],
    ['avatarUri', { avatarUri: 'https://x/y.png' }],
    ['avatarAddress', { avatarAddress: null }],
    ['category', { category: 'Work' }],
    ['status', { status: 'In review' }],
    ['priority', { priority: 'Urgent' }],
    ['assignees', { assigned: ['0x1111111111111111111111111111111111111111'] }],
    ['members', { inboxToAddr: { i1: '0x1111111111111111111111111111111111111111' } }],
  ])('patches a %s change in place and keeps the rest of the row', (_field, change) => {
    const out = applyGroupMeta(rows, 'a', { ...meta, ...change });
    expect(out?.[0]).toEqual({ ...metaRow, ...change });
    expect(out?.[1]).toBe(rowB);
  });

  test('fills metadata on a row that had none', () => {
    expect(applyGroupMeta(rows, 'b', meta)?.[1]).toEqual({ ...rowB, ...meta });
  });

  test.each(['status', 'priority'])('clears %s without changing other row fields', (field) => {
    const filled = { ...metaRow, [field]: 'High' };
    expect(applyGroupMeta([filled], 'a', meta)?.[0]).toEqual({ ...filled, [field]: null });
  });

  test('returns null when nothing changed', () => {
    expect(applyGroupMeta(rows, 'a', { ...meta, labels: ['Todo'] })).toBeNull();
  });

  test('compares members by content', () => {
    const members = { i1: '0x1', i2: '0x2' };
    const withMembers = [channelRow('a', { ...metaRow, inboxToAddr: members })];
    expect(applyGroupMeta(withMembers, 'a', { ...meta, inboxToAddr: { ...members } })).toBeNull();
    expect(applyGroupMeta(withMembers, 'a', { ...meta, inboxToAddr: { i1: '0x1' } })?.[0]?.inboxToAddr).toEqual({ i1: '0x1' });
  });

  test('treats a label reorder as a change', () => {
    const two = [{ ...metaRow, labels: ['A', 'B'] }];
    expect(applyGroupMeta(two, 'a', { ...meta, labels: ['B', 'A'] })?.[0]?.labels).toEqual(['B', 'A']);
  });

  test('returns null for a missing row', () => {
    expect(applyGroupMeta(rows, 'zzz', meta)).toBeNull();
  });
});
