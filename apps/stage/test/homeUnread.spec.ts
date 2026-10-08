import { describe, expect, test } from 'bun:test';
import { GROUP_KEYS, isRowCleared, type ClearedChats, type GroupKey } from '@stage-labs/client/xmtp/readState';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';
import { deriveSortedRows, unreadRowCount, visibleUnreadCount, type Row } from '../components/home/model';
import { parseSearchFilter, searchRowMatcher } from '../components/searchFilter.model';
import { ALICE, NAMES, SELF } from './searchFixtures';

function row(convId: string, unreadCount: number, fields: Partial<Row> = {}): Row {
  return {
    convId, title: convId, groupName: convId, lastPreview: '', createdTs: null, lastTs: 1, lastBubbleTs: null,
    unreadCount, lastReadNs: 0, markedUnread: false, lastFromSelf: false, lastSenderAddress: null,
    peerAddress: null, avatarUri: null, avatarAddress: null, inboxToAddr: { self: SELF }, selfInboxId: 'self', consent: 'allowed',
    labels: [], assigned: [], category: null, status: null, priority: null, ...fields,
  };
}

const rows = [
  row('a', 5, { labels: ['Stage'], status: 'Todo' }),
  row('b', 2, { labels: ['Metro'], status: 'Done' }),
  row('c', 0, { labels: ['Stage'], markedUnread: true }),
  row('d', 0, { labels: ['Stage'] }),
  row('e', 1, { inboxToAddr: { self: SELF, alice: ALICE } }),
  row('dm', 1, { peerAddress: '0xpeer', lastBubbleTs: 10 }),
];
const namesOf = (address: string): string[] => NAMES[address] ?? [];

interface View { view?: 'chats' | 'board'; columnBy?: GroupKey; query?: string; labels?: string[]; unreadOnly?: boolean; cleared?: ClearedChats }

const count = (v: View = {}): number => visibleUnreadCount({
  view: v.view ?? 'chats', columnBy: v.columnBy ?? 'status', rows, enabledLabels: new Set(v.labels ?? []),
  unreadOnly: v.unreadOnly ?? false, matches: searchRowMatcher(parseSearchFilter(v.query ?? ''), namesOf), cleared: v.cleared ?? {},
});

describe('the chats badge counts what the current view shows', () => {
  test('counts unread chats, not messages, and a chat marked unread once', () => {
    expect(count()).toBe(5);
    expect(visibleUnreadCount({ view: 'chats', columnBy: 'status', rows: null, enabledLabels: new Set(), unreadOnly: false, matches: () => true, cleared: {} })).toBe(0);
  });

  test('follows the chat list chips and search filters', () => {
    expect(count({ labels: ['stage'] })).toBe(2);
    expect(count({ unreadOnly: true })).toBe(5);
    expect([count({ query: 'status:Todo' }), count({ query: '-label:Stage' }), count({ query: 'member:alice123' }), count({ query: 'b' })]).toEqual([1, 3, 1, 1]);
  });

  test('leaves out a deleted direct chat until a newer message revives it', () => {
    expect(count({ cleared: { '0xpeer': 20 } })).toBe(4);
    expect(count({ cleared: { '0xpeer': 5 } })).toBe(5);
  });

  test('on the board counts only its cards, with its own search and columns', () => {
    expect(count({ view: 'board', labels: ['metro'], unreadOnly: true })).toBe(4);
    expect(count({ view: 'board', columnBy: 'label' })).toBe(3);
    expect(count({ view: 'board', query: 'label:Stage' })).toBe(2);
  });

  test('matches the rows the chat list and the board render', () => {
    const cleared = { '0xpeer': 20 };
    const hidden = (r: Row): boolean => isRowCleared(cleared, r);
    for (const query of ['', 'status:Todo', '-label:Stage', 'member:alice123', 'b']) {
      const matches = searchRowMatcher(parseSearchFilter(query), namesOf);
      const listed = deriveSortedRows({ rows, enabledLabels: new Set(['stage']), unreadOnly: false, pinned: [] });
      expect(count({ query, labels: ['stage'], cleared })).toBe(unreadRowCount(listed.filter(r => matches(r) && !hidden(r))));
      for (const columnBy of GROUP_KEYS) {
        const cards = searchedColumns(boardColumns(rows, [], [], columnBy, undefined, hidden), query, namesOf).flatMap(c => c.rows);
        expect(count({ view: 'board', columnBy, query, cleared })).toBe(unreadRowCount([...new Map(cards.map(r => [r.convId, r])).values()]));
      }
    }
  });
});
