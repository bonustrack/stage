import { describe, expect, test } from 'bun:test';
import {
  deriveBarLabels,
  filterChannelRows,
  rowMatchesQuery,
  sortChannelRows,
  type ChannelListRow,
} from '../src/xmtp/channelsFilter';

const row = (over: Partial<ChannelListRow> & { convId: string }): ChannelListRow => ({
  title: 'Chat',
  lastPreview: '',
  lastTs: null,
  unreadCount: 0,
  ...over,
});

describe('filterChannelRows', () => {
  const rows = [
    row({ convId: 'a', title: 'Alpha', labels: ['Work'], unreadCount: 2, lastTs: 3 }),
    row({ convId: 'b', title: 'Beta', markedUnread: true, lastTs: 2 }),
    row({ convId: 'c', title: 'Gamma', lastPreview: 'hello world', lastTs: 1 }),
  ];

  test('label filter matches case-insensitively', () => {
    expect(filterChannelRows(rows, { enabledLabels: new Set(['work']) }).map(r => r.convId)).toEqual(['a']);
  });

  test('unreadOnly keeps unread count or markedUnread', () => {
    expect(filterChannelRows(rows, { unreadOnly: true }).map(r => r.convId)).toEqual(['a', 'b']);
  });

  test('query matches title, preview, peerAddress, memberAddresses per field', () => {
    expect(filterChannelRows(rows, { query: 'hello' }).map(r => r.convId)).toEqual(['c']);
    const withPeer = [row({ convId: 'p', peerAddress: '0xAbCd' })];
    expect(filterChannelRows(withPeer, { query: '0xab' })).toHaveLength(1);
    const withMembers = [row({ convId: 'm', memberAddresses: ['0xDEAD'] })];
    expect(filterChannelRows(withMembers, { query: 'dead' })).toHaveLength(1);
  });

  test('empty filter returns all rows', () => {
    expect(filterChannelRows(rows, {})).toHaveLength(3);
  });
});

describe('rowMatchesQuery', () => {
  test('does not match across field boundaries', () => {
    const r = row({ convId: 'x', title: 'say hi', lastPreview: 'bob: yes' });
    expect(rowMatchesQuery(r, 'hi bob')).toBe(false);
    expect(rowMatchesQuery(r, 'say hi')).toBe(true);
  });
});

describe('sortChannelRows', () => {
  test('pinned first, then lastTs descending', () => {
    const rows = [
      row({ convId: 'old', lastTs: 1 }),
      row({ convId: 'new', lastTs: 9 }),
      row({ convId: 'pin', lastTs: 2 }),
    ];
    expect(sortChannelRows(rows, new Set(['pin'])).map(r => r.convId)).toEqual(['pin', 'new', 'old']);
    expect(sortChannelRows(rows).map(r => r.convId)).toEqual(['new', 'pin', 'old']);
  });
});

describe('deriveBarLabels', () => {
  test('dedupes case-insensitively keeping first casing, sorted', () => {
    const labels = deriveBarLabels([
      { labels: ['Work', 'fun'] },
      { labels: ['WORK', 'Alpha'] },
    ]);
    expect(labels).toEqual(['Alpha', 'fun', 'Work']);
  });
});
