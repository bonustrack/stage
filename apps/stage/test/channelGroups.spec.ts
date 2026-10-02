import { describe, expect, test } from 'bun:test';
import {
  NO_GROUPS_PREFS, groupRowsByCategory, isGroupHeader, parseChannelGroupsPrefs, rowsOf, type HomeListItem,
} from '../components/home/groups.model';
import type { Row } from '../components/home/model';

function row(convId: string, extra: Partial<Row> = {}): Row {
  return {
    convId, title: convId, lastTs: 1, lastBubbleTs: 1, lastPreview: '', avatarAddress: null, avatarUri: null,
    peerAddress: null, lastSenderAddress: null, lastFromSelf: false, inboxToAddr: {}, unreadCount: 0, lastReadNs: 0,
    markedUnread: false, selfInboxId: 'me', labels: [], category: null, consent: null, ...extra,
  };
}

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { category: 'Work' });
const work2 = row('work2', { category: 'work', unreadCount: 3 });
const alpha = row('alpha', { category: 'Alpha' });
const loose = row('loose');

function shape(items: HomeListItem[]): string[] {
  return items.map(item => (isGroupHeader(item) ? `# ${item.header.title}` : item.convId));
}

describe('groupRowsByCategory', () => {
  test('direct messages first, categories A to Z, no category last, rows keep their order', () => {
    expect(shape(groupRowsByCategory([work, dm, loose, work2, alpha], new Set(), false)))
      .toEqual(['# Direct messages', 'dm', '# Alpha', 'alpha', '# Work', 'work', 'work2', '# No category', 'loose']);
  });

  test('categories merge case-insensitively under the first spelling seen', () => {
    const items = groupRowsByCategory([work2, work], new Set(), false);
    expect(shape(items)).toEqual(['# work', 'work2', 'work']);
    expect(items[0]).toMatchObject({ convId: 'group:category:work', header: { key: 'category:work', count: 2, unread: 1 } });
  });

  test('a collapsed group keeps its header and hides its rows, a search expands it again', () => {
    const collapsed = new Set(['category:work']);
    const folded = groupRowsByCategory([work, work2, loose], collapsed, false);
    expect(shape(folded)).toEqual(['# Work', '# No category', 'loose']);
    expect(folded[0]).toMatchObject({ header: { collapsed: true, unread: 1, count: 2 } });
    expect(rowsOf(folded).map(r => r.convId)).toEqual(['loose']);
    expect(shape(groupRowsByCategory([work, work2, loose], collapsed, true)))
      .toEqual(['# Work', 'work', 'work2', '# No category', 'loose']);
  });

  test('a marked unread chat counts as unread, empty groups are not shown', () => {
    const marked = row('m', { category: 'Ops', markedUnread: true });
    const items = groupRowsByCategory([marked], new Set(['dm', 'none']), false);
    expect(shape(items)).toEqual(['# Ops', 'm']);
    expect(items[0]).toMatchObject({ header: { unread: 1 } });
    expect(groupRowsByCategory([], new Set(), false)).toEqual([]);
  });
});

describe('parseChannelGroupsPrefs', () => {
  test('reads the saved switch and folded groups, dropping anything else', () => {
    expect(parseChannelGroupsPrefs('{"grouped":true,"collapsed":["dm",3,"category:work"]}'))
      .toEqual({ grouped: true, collapsed: ['dm', 'category:work'] });
    expect(parseChannelGroupsPrefs('{"grouped":"yes"}')).toEqual({ grouped: false, collapsed: [] });
  });

  test('bad or empty storage means off', () => {
    expect(parseChannelGroupsPrefs('nope')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('null')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('[]')).toEqual({ grouped: false, collapsed: [] });
  });
});
