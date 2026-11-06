import { describe, expect, test } from 'bun:test';
import type { ClearedChats } from '@stage-labs/client/xmtp/sync/clear';
import type { Row } from '../components/home/model';
import { homeListing, listedUnreadCount, unreadRowCount } from '../components/home/listing.model';
import { parseSearchFilter, searchRowMatcher } from '../components/home/search/searchFilter.model';
import { ALICE, NAMES, SELF } from './searchFixtures';

function row(convId: string, unreadCount: number, fields: Partial<Row> = {}): Row {
  return {
    convId,
    title: convId,
    groupName: convId,
    lastPreview: '',
    createdTs: null,
    lastTs: 1,
    lastBubbleTs: null,
    unreadCount,
    lastReadNs: 0,
    markedUnread: false,
    lastFromSelf: false,
    lastSenderAddress: null,
    peerAddress: null,
    avatarUri: null,
    avatarAddress: null,
    inboxToAddr: { self: SELF },
    selfInboxId: 'self',
    consent: 'allowed',
    labels: [],
    assigned: [],
    category: null,
    status: null,
    priority: null,
    ...fields,
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

interface View {
  query?: string;
  labels?: string[];
  unreadOnly?: boolean;
  cleared?: ClearedChats;
}

const count = (v: View = {}): number =>
  listedUnreadCount({
    rows,
    enabledLabels: new Set(v.labels ?? []),
    unreadOnly: v.unreadOnly ?? false,
    matches: searchRowMatcher(parseSearchFilter(v.query ?? ''), namesOf),
    cleared: v.cleared ?? {},
  });

describe('the chats badge counts what the chat list shows', () => {
  test('counts unread chats, not messages, and a chat marked unread once', () => {
    expect(count()).toBe(5);
    expect(listedUnreadCount({ rows: null, enabledLabels: new Set(), unreadOnly: false, matches: () => true, cleared: {} })).toBe(0);
  });

  test('follows the chat list chips and search filters', () => {
    expect(count({ labels: ['stage'] })).toBe(2);
    expect(count({ unreadOnly: true })).toBe(5);
    expect([
      count({ query: 'status:Todo' }),
      count({ query: '-label:Stage' }),
      count({ query: 'member:alice123' }),
      count({ query: 'b' }),
    ]).toEqual([1, 3, 1, 1]);
  });

  test('Last activity keeps the badge and visible list consistent, including pinned chats', () => {
    const recent = rows.map((row, index) => ({ ...row, lastTs: index < 2 ? 100 : 1 }));
    const matches = searchRowMatcher(parseSearchFilter(''), namesOf, () => '', 50);
    const visible = homeListing({
      rows: recent,
      enabledLabels: new Set(['stage']),
      unreadOnly: false,
      pinned: ['c'],
      matches,
      cleared: {},
    });
    expect(visible.map((row) => row.convId)).toEqual(['a']);
    expect(listedUnreadCount({ rows: recent, enabledLabels: new Set(['stage']), unreadOnly: false, matches, cleared: {} })).toBe(
      unreadRowCount(visible),
    );
  });

  test('leaves out a deleted direct chat until a newer message revives it', () => {
    expect(count({ cleared: { '0xpeer': 20 } })).toBe(4);
    expect(count({ cleared: { '0xpeer': 5 } })).toBe(5);
  });

  test('matches the rows the chat list renders', () => {
    const cleared = { '0xpeer': 20 };
    for (const query of ['', 'status:Todo', '-label:Stage', 'member:alice123', 'b']) {
      const matches = searchRowMatcher(parseSearchFilter(query), namesOf);
      const listed = homeListing({ rows, enabledLabels: new Set(['stage']), unreadOnly: false, pinned: [], matches, cleared });
      expect(count({ query, labels: ['stage'], cleared })).toBe(unreadRowCount(listed));
    }
  });
});
