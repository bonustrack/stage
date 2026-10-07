import { describe, expect, test } from 'bun:test';
import { applyGroupMeta, applyInbound } from '@stage-labs/client/xmtp/channelsCache';
import { DEFAULT_HOME_VIEW, type HomeSort } from '@stage-labs/client/xmtp/readState';
import { boardColumns, orderedColumns, searchedColumns } from '../components/board/BoardScreen.model';
import { groupRows, isGroupHeader } from '../components/home/groups.model';
import { deriveSortedRows, type Row } from '../components/home/model';
import { homeSortOf, sortHomeRows } from '../components/home/sort.model';

function row(convId: string, fields: Partial<Row> = {}): Row {
  return {
    convId, title: convId, groupName: convId, lastPreview: '', createdTs: null, lastTs: null, lastBubbleTs: null,
    unreadCount: 0, lastReadNs: 0, markedUnread: false, lastFromSelf: false, lastSenderAddress: null,
    peerAddress: null, avatarUri: null, avatarAddress: null, inboxToAddr: {}, selfInboxId: 'self', consent: 'allowed',
    labels: [], assigned: [], category: null, status: null, priority: null, ...fields,
  };
}
const ids = (rows: readonly { convId: string }[]): string[] => rows.map(r => r.convId);
const rows = [
  row('a', { createdTs: 30, lastTs: 10, priority: 'Low', status: 'Done', category: 'Stage', labels: ['Work', 'Other'] }),
  row('b', { createdTs: 10, lastTs: 30, priority: 'Urgent', status: 'Todo', category: 'Metro', labels: ['Work'] }),
  row('c', { createdTs: 20, lastTs: 20, priority: 'High', status: 'Doing', category: 'Stage', labels: ['Work'] }),
];
const order = ['status:todo', 'status:doing', 'status:done'];
const ascending: Record<HomeSort['by'], string[]> = {
  created: ['b', 'c', 'a'], updated: ['a', 'c', 'b'], priority: ['a', 'c', 'b'], status: ['b', 'c', 'a'],
};

for (const by of ['status', 'created', 'updated', 'priority'] as const) {
  for (const direction of ['asc', 'desc'] as const) {
    const sort = { by, direction };
    const expected = direction === 'asc' ? ascending[by] : [...ascending[by]].reverse();
    test(`Chats and Board sort ${by} ${direction} without changing inputs`, () => {
      expect(ids(deriveSortedRows({ rows, enabledLabels: new Set(), unreadOnly: false, pinned: [], sort, statusOrder: order }))).toEqual(expected);
      const board = boardColumns(rows, [], order, 'label', undefined, undefined, sort);
      expect(ids(board.find(c => c.label === 'Work')?.rows ?? [])).toEqual(expected);
      expect(ids(rows)).toEqual(['a', 'b', 'c']);
    });

    test(`${by} ${direction} stays within groups and columns and keeps their order`, () => {
      const sorted = sortHomeRows(rows, [], sort, order);
      const grouped = groupRows(sorted, 'category', new Set(), false, v => v, ['category:stage']);
      expect(grouped.filter(isGroupHeader).map(i => i.header.title)).toEqual(['Stage', 'Metro']);
      expect(grouped.filter(i => !isGroupHeader(i)).map(i => i.convId)).toEqual([...expected.filter(id => id !== 'b'), 'b']);
      const board = orderedColumns(boardColumns(rows, [], [], 'category', undefined, undefined, sort, order), ['category:Stage']);
      expect(board.map(c => c.label)).toEqual(['Stage', 'Metro']);
      expect(board.map(c => ids(c.rows))).toEqual([expected.filter(id => id !== 'b'), ['b']]);
    });
  }
}

describe('sorting defaults and boundaries', () => {
  test('Chats starts ungrouped by Updated descending; Board by Status and highest Priority', () => {
    expect(DEFAULT_HOME_VIEW.groupBy).toBe('none');
    expect(DEFAULT_HOME_VIEW.columnBy).toBe('status');
    expect(homeSortOf(DEFAULT_HOME_VIEW)).toEqual({ by: 'updated', direction: 'desc' });
    expect(homeSortOf({ ...DEFAULT_HOME_VIEW, view: 'board' })).toEqual({ by: 'priority', direction: 'desc' });
    const sameStatus = rows.map(r => ({ ...r, status: 'Todo' }));
    expect(ids(boardColumns(sameStatus, [], [])[0]?.rows ?? [])).toEqual(['b', 'c', 'a']);
  });

  test('priority is urgency order, not alphabetical', () => {
    const priorities = ['High', 'Low', 'Urgent', 'Medium'] as const;
    const input = priorities.map(priority => row(priority, { priority }));
    expect(ids(sortHomeRows(input, [], { by: 'priority', direction: 'desc' }))).toEqual(['Urgent', 'High', 'Medium', 'Low']);
    expect(ids(sortHomeRows(input, [], { by: 'priority', direction: 'asc' }))).toEqual(['Low', 'Medium', 'High', 'Urgent']);
  });

  test('status follows configured column order then case-insensitive custom names', () => {
    const input = ['Zebra', 'Done', 'beta', 'todo', 'Alpha'].map(status => row(status, { status }));
    expect(ids(sortHomeRows(input, [], { by: 'status', direction: 'asc' }, order)))
      .toEqual(['todo', 'Done', 'Alpha', 'beta', 'Zebra']);
  });

  test('equivalent custom status names never depend on cache encounter order', () => {
    const input = [row('a', { status: 'resume', lastTs: 1 }), row('b', { status: 'résumé', lastTs: 1 })];
    for (const direction of ['asc', 'desc'] as const) {
      const sort = { by: 'status', direction } as const;
      expect(ids(sortHomeRows(input, [], sort))).toEqual(ids(sortHomeRows([...input].reverse(), [], sort)));
      expect(ids(sortHomeRows(input, [], sort, ['status:résumé'])))
        .toEqual(direction === 'asc' ? ['b', 'a'] : ['a', 'b']);
    }
  });

  test('missing or invalid values remain last in either direction, ties are deterministic', () => {
    for (const direction of ['asc', 'desc'] as const) {
      for (const by of ['status', 'created', 'updated', 'priority'] as const) {
        const input = [row('z'), row('b', { createdTs: 1, lastTs: 1, status: 'Todo', priority: 'High' }), row('a')];
        expect(ids(sortHomeRows(input, [], { by, direction }))).toEqual(['b', 'a', 'z']);
        expect(ids(sortHomeRows([...input].reverse(), [], { by, direction }))).toEqual(['b', 'a', 'z']);
      }
      expect(ids(sortHomeRows([row('bad', { createdTs: NaN, lastTs: Infinity }), row('ok', { createdTs: 3 })], [], { by: 'updated', direction })))
        .toEqual(['ok', 'bad']);
    }
  });

  test('pinned rows keep their deliberate order ahead of the sorted entries', () => {
    expect(ids(sortHomeRows(rows, ['c', 'a'], { by: 'priority', direction: 'desc' }))).toEqual(['c', 'a', 'b']);
    expect(ids(boardColumns(rows, ['c', 'a'], [], 'label').find(c => c.label === 'Work')?.rows ?? [])).toEqual(['c', 'a', 'b']);
  });

  test('filters, DMs, multiple labels, empty columns, and collapsed groups retain their semantics', () => {
    const input = [...rows, row('dm', { peerAddress: '0xpeer', lastTs: 100, labels: ['Work'] })];
    const chats = deriveSortedRows({ rows: input, enabledLabels: new Set(['other']), unreadOnly: false, pinned: [] });
    expect(ids(chats)).toEqual(['a']);
    expect(deriveSortedRows({ rows: input, enabledLabels: new Set(), unreadOnly: true, pinned: [] })).toEqual([]);
    const board = boardColumns(input, [], ['label:Empty'], 'label', undefined, r => r.convId === 'c');
    expect(board.map(c => [c.label, ids(c.rows)])).toEqual([['Other', ['a']], ['Work', ['b', 'a']], ['Empty', []]]);
    expect(searchedColumns(board, 'a').map(c => [c.label, ids(c.rows)])).toEqual([['Other', ['a']], ['Work', ['a']], ['Empty', []]]);
    const grouped = groupRows(sortHomeRows(input, []), 'category', new Set(['category:stage']), false, v => v);
    expect(grouped.filter(i => !isGroupHeader(i)).map(i => i.convId)).toEqual(['dm', 'b']);
  });

  test('live activity and metadata changes re-sort without changing creation timestamps', () => {
    const inbound = applyInbound(rows, { convId: 'a', sentNs: 50_000_000, lastTs: 50, lastPreview: 'New activity' });
    expect(ids(sortHomeRows(inbound?.next ?? [], [], { by: 'updated', direction: 'desc' }))).toEqual(['a', 'b', 'c']);
    expect(ids(sortHomeRows(inbound?.next ?? [], [], { by: 'created', direction: 'asc' }))).toEqual(['b', 'c', 'a']);
    const changed = applyGroupMeta(rows, 'a', {
      title: 'a', groupName: 'a', avatarUri: null, avatarAddress: null, labels: ['Work'], assigned: [],
      category: 'Stage', status: 'Backlog', priority: 'Urgent',
    });
    expect(ids(sortHomeRows(changed ?? [], [], { by: 'priority', direction: 'desc' }))).toEqual(['b', 'a', 'c']);
    expect(ids(sortHomeRows(changed ?? [], [], { by: 'status', direction: 'asc' }))).toEqual(['a', 'c', 'b']);
  });
});
