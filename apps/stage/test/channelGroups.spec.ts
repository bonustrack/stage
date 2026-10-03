import { describe, expect, test } from 'bun:test';
import { groupRowsByCategory, isGroupHeader, rowsOf, type HomeListItem } from '../components/home/groups.model';
import {
  NO_GROUPS_PREFS, categoryOrderWith, movedCategoryOrder, parseChannelGroupsPrefs,
} from '../lib/channelGroups.model';
import { blockShift, dropTarget, sectionBlocks, sectionShape, uniformBlocks } from '../components/home/listDrag.model';
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

  test('a saved order ranks categories first, the rest follow A to Z, direct messages and no category stay put', () => {
    const ops = row('ops', { category: 'Ops' });
    const order = ['category:work', 'category:ops'];
    expect(shape(groupRowsByCategory([dm, alpha, loose, ops, work], new Set(), false, order)))
      .toEqual(['# Direct messages', 'dm', '# Work', 'work', '# Ops', 'ops', '# Alpha', 'alpha', '# No category', 'loose']);
    expect(shape(groupRowsByCategory([alpha, ops, work], new Set(), false, ['category:zzz', 'category:ops'])))
      .toEqual(['# Ops', 'ops', '# Alpha', 'alpha', '# Work', 'work']);
  });

  test('a marked unread chat counts as unread, empty groups are not shown', () => {
    const marked = row('m', { category: 'Ops', markedUnread: true });
    const items = groupRowsByCategory([marked], new Set(['dm', 'none']), false);
    expect(shape(items)).toEqual(['# Ops', 'm']);
    expect(items[0]).toMatchObject({ header: { unread: 1 } });
    expect(groupRowsByCategory([], new Set(), false)).toEqual([]);
  });
});

describe('category order', () => {
  test('the full order is the saved keys then the visible unsaved ones A to Z', () => {
    expect(categoryOrderWith(['category:work', 'category:hidden'], ['category:zed', 'category:work', 'category:alpha']))
      .toEqual(['category:work', 'category:hidden', 'category:alpha', 'category:zed']);
  });

  test('a drop moves the category to the target slot and keeps hidden categories in place', () => {
    const visible = ['category:a', 'category:b', 'category:c'];
    expect(movedCategoryOrder([], visible, 'category:a', 'category:c')).toEqual(['category:b', 'category:c', 'category:a']);
    expect(movedCategoryOrder([], visible, 'category:c', 'category:a')).toEqual(['category:c', 'category:a', 'category:b']);
    expect(movedCategoryOrder(['category:a', 'category:x', 'category:b', 'category:c'], visible, 'category:a', 'category:c'))
      .toEqual(['category:x', 'category:b', 'category:c', 'category:a']);
  });
});

describe('parseChannelGroupsPrefs', () => {
  test('reads the saved switch, folded groups and order, dropping anything else', () => {
    expect(parseChannelGroupsPrefs('{"grouped":true,"collapsed":["dm",3,"category:work"],"order":["category:work",1]}'))
      .toEqual({ grouped: true, collapsed: ['dm', 'category:work'], order: ['category:work'] });
    expect(parseChannelGroupsPrefs('{"grouped":"yes"}')).toEqual({ grouped: false, collapsed: [], order: [] });
  });

  test('bad or empty storage means off', () => {
    expect(parseChannelGroupsPrefs('nope')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('null')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('[]')).toEqual({ grouped: false, collapsed: [], order: [] });
  });
});

describe('list drag blocks', () => {
  const HEADER = 40;
  const ROW = 67;

  test('pinned rows are one block each of the row height', () => {
    const blocks = uniformBlocks(['a', 'b', 'c'], ROW);
    expect(blocks.tops).toEqual([0, ROW, 2 * ROW]);
    expect(blocks.heights).toEqual([ROW, ROW, ROW]);
    expect(blocks.blockOf.get('c')).toBe(2);
  });

  test('a section block is its header plus its visible rows, direct messages and no category are not blocks', () => {
    const items = groupRowsByCategory([dm, work, work2, alpha, loose], new Set(['category:work']), false);
    const blocks = sectionBlocks(items, HEADER, ROW);
    expect(blocks.ids).toEqual(['category:alpha', 'category:work']);
    expect(blocks.heights).toEqual([HEADER + ROW, HEADER]);
    expect(blocks.tops).toEqual([0, HEADER + ROW]);
    expect(blocks.blockOf.get('group:category:alpha')).toBe(0);
    expect(blocks.blockOf.get('alpha')).toBe(0);
    expect(blocks.blockOf.get('group:category:work')).toBe(1);
    expect(blocks.blockOf.has('dm')).toBe(false);
    expect(blocks.blockOf.has('group:dm')).toBe(false);
    expect(blocks.blockOf.has('loose')).toBe(false);
  });

  test('the shape names the sections and their rows, so equal shapes give equal blocks', () => {
    const items = groupRowsByCategory([dm, work, alpha], new Set(), false);
    expect(sectionShape(items)).toBe('#dm\ndm\n#category:alpha\nalpha\n#category:work\nwork');
    const renamed = groupRowsByCategory([dm, { ...work, title: 'Renamed', unreadCount: 2 }, alpha], new Set(), false);
    expect(sectionShape(renamed)).toBe(sectionShape(items));
    expect(sectionShape(groupRowsByCategory([dm, work, alpha], new Set(['category:work']), false))).not.toBe(sectionShape(items));
  });

  test('the drop target changes once the moved block passes the middle of a neighbour', () => {
    const uniform = uniformBlocks(['a', 'b', 'c', 'd'], ROW);
    expect(dropTarget(uniform.tops, uniform.heights, 1, ROW * 0.4)).toBe(1);
    expect(dropTarget(uniform.tops, uniform.heights, 1, ROW * 0.6)).toBe(2);
    expect(dropTarget(uniform.tops, uniform.heights, 1, ROW * 5)).toBe(3);
    expect(dropTarget(uniform.tops, uniform.heights, 2, -ROW * 0.6)).toBe(1);
    expect(dropTarget(uniform.tops, uniform.heights, 2, -ROW * 5)).toBe(0);
    const tall = { tops: [0, 300, 340], heights: [300, 40, 200] };
    expect(dropTarget(tall.tops, tall.heights, 0, 15)).toBe(0);
    expect(dropTarget(tall.tops, tall.heights, 0, 25)).toBe(1);
    expect(dropTarget(tall.tops, tall.heights, 0, 145)).toBe(2);
    expect(dropTarget(tall.tops, tall.heights, 2, -15)).toBe(2);
    expect(dropTarget(tall.tops, tall.heights, 2, -25)).toBe(1);
    expect(dropTarget(tall.tops, tall.heights, 2, -200)).toBe(0);
  });

  test('blocks between the start and the target shift by the moved height, the rest stay', () => {
    expect(blockShift(2, 1, 3, 300)).toBe(-300);
    expect(blockShift(3, 1, 3, 300)).toBe(-300);
    expect(blockShift(0, 1, 3, 300)).toBe(0);
    expect(blockShift(1, 3, 1, 300)).toBe(300);
    expect(blockShift(2, 3, 1, 300)).toBe(300);
    expect(blockShift(3, 3, 1, 300)).toBe(0);
  });
});
