import { describe, expect, test } from 'bun:test';
import {
  boardFilterMenu, boardFilterSources, boardRowMatcher, memberNames, memberTokenValue, parseBoardFilter, pickBoardFilter,
  type BoardFilterRow, type FilterMenu, type FilterOptions,
} from '../components/board/boardFilter.model';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';

const SELF = '0xself';
const ALICE = '0xa11ce00000000000000000000000000000000001';
const BOB = '0xb0b0000000000000000000000000000000000002';

function group(convId: string, labels: string[], members: string[] = []): BoardFilterRow {
  const inboxToAddr = Object.fromEntries([['self', SELF], ...members.map((address, i) => [`inbox-${i}`, address])]);
  return { convId, title: convId, lastPreview: '', lastTs: 1, unreadCount: 0, labels, inboxToAddr, selfInboxId: 'self' };
}

const NAMES: Record<string, string[]> = {
  [ALICE]: memberNames('alice123.stage.base.eth', 'Alice Doe'),
  [BOB]: memberNames('bob.base.eth', undefined),
};

const namesOf = (address: string): string[] => NAMES[address] ?? [];

const rows = [
  group('build', ['🚧 In progress'], [ALICE]),
  group('ship', ['🚧 In progress', 'Bug'], [BOB]),
  group('plan', ['Todo'], [ALICE, BOB]),
];

const matching = (query: string): string[] => {
  const matches = boardRowMatcher(parseBoardFilter(query), namesOf);
  return rows.filter(matches).map(row => row.convId);
};

describe('parsing the board filter', () => {
  test('splits label and member tokens from the free text', () => {
    expect(parseBoardFilter('label:"🚧 In progress" member:alice123 ship it')).toEqual({
      labels: ['🚧 In progress'], members: ['alice123'], text: 'ship it',
    });
  });

  test('field names ignore case, empty values filter nothing and extra spaces go away', () => {
    expect(parseBoardFilter('  LABEL:Todo   Member:  label:""  ')).toEqual({ labels: ['Todo'], members: [], text: '' });
  });

  test('an unfinished quote keeps the rest of the words in the value', () => {
    expect(parseBoardFilter('label:"🚧 In').labels).toEqual(['🚧 In']);
  });
});

describe('matching board cards', () => {
  test('values of one field are OR, different fields are AND', () => {
    expect(matching('label:Todo label:Bug')).toEqual(['ship', 'plan']);
    expect(matching('label:"🚧 in progress" member:bob.base.eth')).toEqual(['ship']);
  });

  test('a member matches by username, @username, full name, display name or address start', () => {
    expect(matching('member:alice123')).toEqual(['build', 'plan']);
    expect(matching('member:@alice123')).toEqual(['build', 'plan']);
    expect(matching('member:alice123.stage.base.eth')).toEqual(['build', 'plan']);
    expect(matching('member:"alice doe"')).toEqual(['build', 'plan']);
    expect(matching('member:0xB0B0')).toEqual(['ship', 'plan']);
  });

  test('you are not a member you can filter on', () => {
    expect(matching(`member:${SELF}`)).toEqual([]);
  });

  test('free text still matches titles next to the tokens', () => {
    expect(matching('label:"🚧 In progress" shi')).toEqual(['ship']);
    expect(matching('nothing')).toEqual([]);
  });

  test('searched columns keep every column and filter their cards', () => {
    const shown = searchedColumns(boardColumns(rows, [], []), 'member:bob.base.eth', namesOf);
    expect(shown.map(c => [c.label, c.rows.map(r => r.convId)])).toEqual([
      ['🚧 In progress', ['ship']], ['Bug', ['ship']], ['Todo', ['plan']],
    ]);
  });
});

describe('filter values on the board', () => {
  test('labels and members come from labelled channels only, without you', () => {
    const dm = { ...group('dm', ['Todo'], [BOB]), peerAddress: BOB };
    const unlabelled = group('loose', [], ['0xc0ffee']);
    expect(boardFilterSources([...rows, dm, unlabelled, group('dup', ['todo'])])).toEqual({
      labels: ['🚧 In progress', 'Bug', 'Todo'], members: [ALICE, BOB],
    });
  });

  test('a member token uses the username when there is one, else the address', () => {
    expect(memberTokenValue(ALICE, 'alice123.stage.base.eth')).toBe('alice123');
    expect(memberTokenValue(BOB, 'bob.base.eth')).toBe('bob.base.eth');
    expect(memberTokenValue('0xABC', undefined)).toBe('0xabc');
  });
});

describe('the filter menu', () => {
  const options: FilterOptions = {
    label: [
      { key: '🚧 In progress', label: '🚧 In progress', value: '🚧 In progress' },
      { key: 'Todo', label: 'Todo', value: 'Todo' },
    ],
    member: [{ key: ALICE, label: '@alice123', value: 'alice123' }],
  };
  const menu = (query: string, caret = query.length): FilterMenu | null => boardFilterMenu(query, caret, options);

  test('an empty search or a new word lists the fields, a typed prefix narrows them', () => {
    expect(menu('')).toEqual({ kind: 'fields', word: { start: 0, end: 0 }, fields: ['label', 'member'] });
    expect(menu('bug ')).toEqual({ kind: 'fields', word: { start: 4, end: 4 }, fields: ['label', 'member'] });
    expect(menu('ME')).toMatchObject({ kind: 'fields', fields: ['member'] });
    expect(menu('bug')).toBeNull();
  });

  test('a field lists its values, narrowed by what follows the colon', () => {
    expect(menu('label:')).toMatchObject({ kind: 'values', field: 'label', options: options.label });
    expect(menu('label:"🚧 in')).toMatchObject({ kind: 'values', options: [options.label[0]] });
    expect(menu('member:@ali')).toMatchObject({ kind: 'values', field: 'member', options: options.member });
    expect(menu('label:nope')).toBeNull();
  });

  test('the menu follows the word under the caret', () => {
    expect(menu('label: bug', 6)).toMatchObject({ kind: 'values', word: { start: 0, end: 6 } });
  });

  test('picking a field starts its token, picking a value completes it', () => {
    const fields = menu('bug me');
    const values = menu('label:"🚧 in');
    if (fields === null || values === null) throw new Error('menu expected');
    expect(pickBoardFilter('bug me', fields, 0)).toEqual({ query: 'bug member:', caret: 11 });
    expect(pickBoardFilter('label:"🚧 in', values, 0)).toEqual({ query: 'label:"🚧 In progress" ', caret: 23 });
    expect(pickBoardFilter('label:"🚧 in', values, 5)).toBeNull();
  });

  test('picking inside the search keeps the words after it', () => {
    const values = menu('label:to  bug', 8);
    if (values === null) throw new Error('menu expected');
    expect(pickBoardFilter('label:to  bug', values, 0)).toEqual({ query: 'label:Todo bug', caret: 11 });
  });
});
