import { describe, expect, test } from 'bun:test';
import { filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import {
  isSearchFilterOn, memberNames, memberTokenValue, parseSearchFilter, pickSearchFilter, searchFilterMenu, searchFilterSources,
  searchFilterValues, searchRowMatcher, toggleSearchFilter, type FilterMenu, type FilterOptions, type FilterRow,
} from '../components/searchFilter.model';
import { boardColumns, searchedColumns } from '../components/board/BoardScreen.model';

const SELF = '0xself';
const ALICE = '0xa11ce00000000000000000000000000000000001';
const BOB = '0xb0b0000000000000000000000000000000000002';

function group(convId: string, labels: string[], members: string[] = []): FilterRow {
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
  const matches = searchRowMatcher(parseSearchFilter(query), namesOf);
  return rows.filter(matches).map(row => row.convId);
};

describe('parsing the search filter', () => {
  test('splits label and member tokens from the free text', () => {
    expect(parseSearchFilter('label:"🚧 In progress" member:alice123 ship it')).toEqual({
      labels: ['🚧 In progress'], members: ['alice123'], text: 'ship it',
    });
  });

  test('field names ignore case, empty values filter nothing and extra spaces go away', () => {
    expect(parseSearchFilter('  LABEL:Todo   Member:  label:""  ')).toEqual({ labels: ['Todo'], members: [], text: '' });
  });

  test('an unfinished quote keeps the rest of the words in the value', () => {
    expect(parseSearchFilter('label:"🚧 In').labels).toEqual(['🚧 In']);
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
    expect(searchFilterSources([...rows, dm, unlabelled, group('dup', ['todo'])], 'board')).toEqual({
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
  const menu = (query: string, caret = query.length): FilterMenu | null => searchFilterMenu(query, caret, options);

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
    expect(pickSearchFilter('bug me', fields, 0)).toEqual({ query: 'bug member:', caret: 11 });
    expect(pickSearchFilter('label:"🚧 in', values, 0)).toEqual({ query: 'label:"🚧 In progress" ', caret: 23 });
    expect(pickSearchFilter('label:"🚧 in', values, 5)).toBeNull();
  });

  test('picking inside the search keeps the words after it', () => {
    const values = menu('label:to  bug', 8);
    if (values === null) throw new Error('menu expected');
    expect(pickSearchFilter('label:to  bug', values, 0)).toEqual({ query: 'label:Todo bug', caret: 11 });
  });
});

describe('the search filter on the chats page', () => {
  const dm: FilterRow = { ...group('bob dm', [], [BOB]), peerAddress: BOB, lastPreview: 'see you at lunch' };
  const chats = [...rows, dm];
  const found = (query: string): string[] => (
    chats.filter(searchRowMatcher(parseSearchFilter(query), namesOf)).map(row => row.convId)
  );

  test('every chat gives values, direct chats and unlabelled groups included, without you', () => {
    const loose = group('loose', [], ['0xc0ffee']);
    expect(searchFilterSources([...chats, loose], 'chats')).toEqual({
      labels: ['🚧 In progress', 'Bug', 'Todo'], members: [ALICE, BOB, '0xc0ffee'],
    });
  });

  test('a member filter finds the direct chat with that member', () => {
    expect(found('member:bob.base.eth')).toEqual(['ship', 'plan', 'bob dm']);
    expect(found('member:bob.base.eth lunch')).toEqual(['bob dm']);
  });

  test('free text alone matches like the chats search did', () => {
    for (const query of ['lunch', 'PLAN', ' ship ', 'bob dm', BOB.slice(0, 8), 'nothing']) {
      expect(found(query)).toEqual(filterChannelRows(chats, { query }).map(row => row.convId));
    }
  });
});

describe('the filter chips on narrow screens', () => {
  test('a picked value is added as a token after what is already typed', () => {
    expect(toggleSearchFilter('', 'label', '🚧 In progress')).toBe('label:"🚧 In progress" ');
    expect(toggleSearchFilter('ship label:Todo', 'member', 'alice123')).toBe('ship label:Todo member:alice123 ');
  });

  test('picking a value again removes its token and keeps the rest', () => {
    expect(toggleSearchFilter('ship label:todo member:alice123 ', 'label', 'Todo')).toBe('ship member:alice123 ');
    expect(toggleSearchFilter('member:@alice123', 'member', 'alice123')).toBe('');
  });

  test('a chip is on when its field has a value, a value is on when its token is there', () => {
    expect(searchFilterValues('ship label:Todo label:Bug', 'label')).toEqual(['Todo', 'Bug']);
    expect(searchFilterValues('ship label:Todo', 'member')).toEqual([]);
    expect(isSearchFilterOn('label:"🚧 in progress"', 'label', '🚧 In progress')).toBe(true);
    expect(isSearchFilterOn('member:@alice123', 'member', 'alice123')).toBe(true);
    expect(isSearchFilterOn('label:Todo', 'member', 'Todo')).toBe(false);
  });

  test('a toggled search parses back to the same filter', () => {
    expect(parseSearchFilter(toggleSearchFilter('ship', 'label', '🚧 In progress'))).toEqual({
      labels: ['🚧 In progress'], members: [], text: 'ship',
    });
  });
});
