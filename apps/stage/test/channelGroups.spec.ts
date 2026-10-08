import { describe, expect, mock, test } from 'bun:test';
import { acceptsDrop, boardColumns, columnMovable, orderedColumns } from '../components/board/BoardScreen.model';
import {
  groupRows, isGroupHeader, listKeyOf, rowsOf, type HomeListItem,
} from '../components/home/groups.model';
import {
  NO_GROUPS_PREFS, categoryKeysOf, categoryOrderWith, movedCategoryOrder, parseChannelGroupsPrefs,
} from '../lib/channelGroups.model';
import {
  blockShift, categoryZones, domElementOf, dragTarget, dropTarget, sectionBlocks, sectionShape, rowBlocks, zoneTarget,
} from '../components/home/listDrag.model';
import type { Row } from '../components/home/model';

const values = new Map<string, string>();
let activeId = 'ann';
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
const { adoptBoardCategoryOrder, applyRemoteCategoryOrder, loadCategoryOrder, moveCategory, onCategoryOrderChanged, setCategoryOrder } = await import('../lib/channelGroups');
const { applyRemoteBoardOrder } = await import('../lib/boardOrder');

function row(convId: string, extra: Partial<Row> = {}): Row {
  return {
    convId, title: convId, lastTs: 1, lastBubbleTs: 1, lastPreview: '', avatarAddress: null, avatarUri: null,
    peerAddress: null, lastSenderAddress: null, lastFromSelf: false, inboxToAddr: {}, unreadCount: 0, lastReadNs: 0,
    markedUnread: false, selfInboxId: 'me', labels: [], category: null, assigned: [], consent: null, ...extra,
  };
}

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { category: 'Work', labels: ['Todo'], assigned: ['0xbob'] });
const work2 = row('work2', { category: 'work', unreadCount: 3, labels: ['Done', 'Todo'], assigned: ['0xalice', '0xbob'] });
const alpha = row('alpha', { category: 'Alpha', labels: ['Done'] });
const loose = row('loose');

const names: Record<string, string> = { '0xbob': 'Bob', '0xalice': 'Alice' };
const nameOf = (address: string): string => names[address] ?? address;

function shape(items: HomeListItem[]): string[] {
  return items.map(item => (isGroupHeader(item) ? `# ${item.header.title}` : item.convId));
}

describe('groupRows by category', () => {
  test('direct messages first, categories A to Z, no category last, rows keep their order', () => {
    expect(shape(groupRows([work, dm, loose, work2, alpha], 'category', new Set(), false, nameOf)))
      .toEqual(['# Direct messages', 'dm', '# Alpha', 'alpha', '# Work', 'work', 'work2', '# No project', 'loose']);
  });

  test('categories merge case-insensitively under the first spelling seen', () => {
    const items = groupRows([work2, work], 'category', new Set(), false, nameOf);
    expect(shape(items)).toEqual(['# work', 'work2', 'work']);
    expect(items[0]).toMatchObject({ convId: 'group:category:work', header: { key: 'category:work', count: 2, unread: 1 } });
  });

  test('a collapsed group keeps its header and hides its rows, a search expands it again', () => {
    const collapsed = new Set(['category:work']);
    const folded = groupRows([work, work2, loose], 'category', collapsed, false, nameOf);
    expect(shape(folded)).toEqual(['# Work', '# No project', 'loose']);
    expect(folded[0]).toMatchObject({ header: { collapsed: true, unread: 1, count: 2 } });
    expect(rowsOf(folded).map(r => r.convId)).toEqual(['loose']);
    expect(shape(groupRows([work, work2, loose], 'category', collapsed, true, nameOf)))
      .toEqual(['# Work', 'work', 'work2', '# No project', 'loose']);
  });

  test('a saved order ranks categories first, the rest follow A to Z, direct messages and no category stay put', () => {
    const ops = row('ops', { category: 'Ops' });
    const order = ['category:work', 'category:ops'];
    expect(shape(groupRows([dm, alpha, loose, ops, work], 'category', new Set(), false, nameOf, order)))
      .toEqual(['# Direct messages', 'dm', '# Work', 'work', '# Ops', 'ops', '# Alpha', 'alpha', '# No project', 'loose']);
    expect(shape(groupRows([alpha, ops, work], 'category', new Set(), false, nameOf, ['category:zzz', 'category:ops'])))
      .toEqual(['# Ops', 'ops', '# Alpha', 'alpha', '# Work', 'work']);
  });

  test('a marked unread chat counts as unread, empty groups are not shown', () => {
    const marked = row('m', { category: 'Ops', markedUnread: true });
    const items = groupRows([marked], 'category', new Set(['dm', 'none']), false, nameOf);
    expect(shape(items)).toEqual(['# Ops', 'm']);
    expect(items[0]).toMatchObject({ header: { unread: 1 } });
    expect(groupRows([], 'category', new Set(), false, nameOf)).toEqual([]);
  });
});

describe('groupRows by label and assignee', () => {
  test('one section per label, a chat with several labels shows under each, no label last', () => {
    const items = groupRows([work, work2, alpha, loose, dm], 'label', new Set(), false, nameOf);
    expect(shape(items)).toEqual(['# Direct messages', 'dm', '# Done', 'work2', 'alpha', '# Todo', 'work', 'work2', '# No label', 'loose']);
    expect(items[2]).toMatchObject({ header: { key: 'label:done', count: 2 } });
  });

  test('one section per assignee named after the person, unassigned last', () => {
    const items = groupRows([work, work2, loose], 'assignee', new Set(), false, nameOf);
    expect(shape(items)).toEqual(['# Alice', 'work2', '# Bob', 'work', 'work2', '# Unassigned', 'loose']);
    expect(items[0]).toMatchObject({ header: { key: 'assignee:0xalice' } });
  });

  test('a chat shown twice keeps one plain list key and gets a section key for the repeat', () => {
    const items = groupRows([work2], 'label', new Set(), false, nameOf);
    expect(items.map(listKeyOf)).toEqual(['group:label:done', 'work2', 'group:label:todo', 'label:todo/work2']);
    expect(rowsOf(items)).toHaveLength(2);
    expect(rowsOf(items)[0]).toBe(work2);
  });

  test('a repeat in a collapsed first section shows plainly in the next', () => {
    const items = groupRows([work2], 'label', new Set(['label:done']), false, nameOf);
    expect(items.map(listKeyOf)).toEqual(['group:label:done', 'group:label:todo', 'work2']);
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
  test('reads the folded groups and order, dropping anything else', () => {
    expect(parseChannelGroupsPrefs('{"grouped":true,"collapsed":["dm",3,"category:work"],"order":["category:work",1]}'))
      .toEqual({ collapsed: ['dm', 'category:work'], order: ['category:work'] });
    expect(parseChannelGroupsPrefs('{"grouped":"yes"}')).toEqual({ collapsed: [], order: [] });
  });

  test('bad or empty storage means nothing folded', () => {
    expect(parseChannelGroupsPrefs('nope')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('null')).toBe(NO_GROUPS_PREFS);
    expect(parseChannelGroupsPrefs('[]')).toEqual({ collapsed: [], order: [] });
  });
});

describe('list drag blocks', () => {
  const HEADER = 40;
  const ROW = 67;

  test('pinned rows are one block each of the row height', () => {
    const blocks = rowBlocks(['a', 'b', 'c'], ROW);
    expect(blocks.tops).toEqual([0, ROW, 2 * ROW]);
    expect(blocks.heights).toEqual([ROW, ROW, ROW]);
    expect(blocks.blockOf.get('c')).toBe(2);
  });

  test('a section block is its header plus its visible rows, direct messages and no category are not blocks', () => {
    const items = groupRows([dm, work, work2, alpha, loose], 'category', new Set(['category:work']), false, nameOf);
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

  test('only category sections are blocks, so other groupings cannot be dragged', () => {
    expect(sectionBlocks(groupRows([work, alpha], 'label', new Set(), false, nameOf), HEADER, ROW).ids).toEqual([]);
    expect(sectionBlocks(groupRows([work], 'assignee', new Set(), false, nameOf), HEADER, ROW).ids).toEqual([]);
  });

  test('the shape names sections and rows independently of their display metadata', () => {
    const items = groupRows([dm, work, alpha], 'category', new Set(), false, nameOf);
    expect(sectionShape(items)).toBe('#dm\ndm\n#category:alpha\nalpha\n#category:work\nwork');
    const renamed = groupRows([dm, { ...work, title: 'Renamed', unreadCount: 2 }, alpha], 'category', new Set(), false, nameOf);
    expect(sectionShape(renamed)).toBe(sectionShape(items));
    expect(sectionShape(groupRows([dm, work, alpha], 'category', new Set(['category:work']), false, nameOf))).not.toBe(sectionShape(items));
  });

  test('the drop target changes once the moved block passes the middle of a neighbour', () => {
    const uniform = rowBlocks(['a', 'b', 'c', 'd'], ROW);
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

describe('moving a chat to another category', () => {
  const HEADER = 40;
  const ROW = 67;
  const items = groupRows([dm, work, work2, alpha, loose], 'category', new Set(), false, nameOf);
  const { blocks, categories } = categoryZones(items, HEADER, ROW);
  const at = (from: number, offset: number): number => zoneTarget(blocks.tops, blocks.heights, blocks.zones, from, offset);

  test('every header and row is a block, each tagged with the section it drops into', () => {
    expect(blocks.ids).toEqual(['dm', 'dm', 'category:alpha', 'alpha', 'category:work', 'work', 'work2', 'none', 'loose']);
    expect(blocks.heights).toEqual([HEADER, ROW, HEADER, ROW, HEADER, ROW, ROW, HEADER, ROW]);
    expect(blocks.zones).toEqual([-1, -1, 2, 2, 4, 4, 4, 7, 7]);
  });

  test('channel rows and their headers can take part, direct messages cannot', () => {
    expect(blocks.blockOf.get('work2')).toBe(6);
    expect(blocks.blockOf.get('loose')).toBe(8);
    expect(blocks.blockOf.get('group:category:alpha')).toBe(2);
    expect(blocks.blockOf.get('group:none')).toBe(7);
    expect(blocks.blockOf.has('dm')).toBe(false);
    expect(blocks.blockOf.has('group:dm')).toBe(false);
  });

  test('each target section writes its first spelling, no category clears it', () => {
    expect([...categories]).toEqual([['category:alpha', 'Alpha'], ['category:work', 'Work'], ['none', null]]);
  });

  test('the target is the section under the middle of the dragged row', () => {
    expect(at(6, -200)).toBe(2);
    expect(at(6, 60)).toBe(7);
    expect(at(6, 2000)).toBe(7);
    expect(at(8, -250)).toBe(2);
    expect(at(8, -100)).toBe(4);
  });

  test('its own section and the direct messages are no target', () => {
    expect(at(6, 0)).toBe(6);
    expect(at(6, -60)).toBe(6);
    expect(at(6, -300)).toBe(6);
    expect(at(6, -2000)).toBe(6);
  });

  test('a folded section takes a drop on its header', () => {
    const folded = categoryZones(groupRows([work, alpha], 'category', new Set(['category:work']), false, nameOf), HEADER, ROW);
    expect(folded.blocks.ids).toEqual(['category:alpha', 'alpha', 'category:work']);
    expect(zoneTarget(folded.blocks.tops, folded.blocks.heights, folded.blocks.zones, 1, ROW)).toBe(2);
  });

  test('reorder drags keep their block logic, zone drags use the sections', () => {
    const uniform = rowBlocks(['a', 'b', 'c'], ROW);
    expect(dragTarget(uniform.tops, uniform.heights, uniform.zones, 1, ROW * 0.6)).toBe(2);
    expect(dragTarget(blocks.tops, blocks.heights, blocks.zones, 6, -200)).toBe(2);
  });
});

describe('domElementOf', () => {
  test('a native view is never a DOM node, even where HTMLElement exists', () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
    class NativeElement { readonly tagName = 'RN:View'; }
    Object.defineProperty(globalThis, 'HTMLElement', { value: NativeElement, configurable: true, writable: true });
    try {
      const view = new NativeElement();
      expect(domElementOf(view, false)).toBeNull();
      expect(domElementOf(view, true)).toBe(view as HTMLElement);
      expect(domElementOf(null, true)).toBeNull();
    } finally {
      if (saved === undefined) Reflect.deleteProperty(globalThis, 'HTMLElement');
      else Object.defineProperty(globalThis, 'HTMLElement', saved);
    }
  });
});

describe('one category order for the chat list and the board', () => {
  const ops = row('ops', { category: 'Ops' });
  const rows = [dm, work, alpha, ops, loose];
  const sections = (order: readonly string[]): string[] =>
    groupRows(rows, 'category', new Set(), false, nameOf, order).filter(isGroupHeader).map(item => item.header.title);
  const columns = (order: readonly string[]): string[] =>
    orderedColumns(boardColumns(rows, [], [], 'category', nameOf), order).map(column => column.label);
  const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
  const sent: string[][] = [];
  onCategoryOrderChanged(change => { sent.push([...change.order]); });

  test('the same order drives the chat sections and the board columns, no category last in both', () => {
    const order = ['category:ops', 'category:work'];
    expect(sections(order)).toEqual(['Direct messages', 'Ops', 'Work', 'Alpha', 'No project']);
    expect(columns(order)).toEqual(['Ops', 'Work', 'Alpha', 'No project']);
    expect(sections([]).slice(1)).toEqual(columns([]));
  });

  test('category keys keep their spelling and are named and case-insensitively unique', () => {
    expect(categoryKeysOf(['label:Todo', 'category:Work', 'category:', 'category:work', 'assignee:0xbob', 'category:Ops']))
      .toEqual(['category:Work', 'category:Ops']);
  });

  test('a board column drag reorders the chat sections and goes out to the other devices', async () => {
    expect(await loadCategoryOrder('ann')).toEqual([]);
    const board = orderedColumns(boardColumns(rows, [], [], 'category', nameOf), []).map(column => column.key);
    moveCategory('category:Work', 'category:Alpha', board);
    await settle();
    const order = await loadCategoryOrder('ann');
    expect(order).toEqual(['category:Work', 'category:Alpha', 'category:Ops']);
    expect(sent).toEqual([order]);
    expect(sections(order)).toEqual(['Direct messages', 'Work', 'Alpha', 'Ops', 'No project']);
  });

  test('a chat section drag reorders the board columns', async () => {
    const visible = sectionBlocks(groupRows(rows, 'category', new Set(), false, nameOf, await loadCategoryOrder('ann')), 40, 67).ids;
    moveCategory('category:ops', 'category:work', visible);
    await settle();
    expect(columns(await loadCategoryOrder('ann'))).toEqual(['Ops', 'Work', 'Alpha', 'No project']);
  });

  test('no category stays last on the board: it is not dragged and takes no column', () => {
    expect(columnMovable('category:')).toBe(false);
    expect(columnMovable('assignee:')).toBe(true);
    expect(acceptsDrop({ kind: 'column', key: 'category:Work' }, 'category:')).toBe(false);
    expect(acceptsDrop({ kind: 'column', key: 'category:Work' }, 'category:Ops')).toBe(true);
    expect(movedCategoryOrder(['category:ops'], ['category:Ops', 'category:Work', 'category:'], 'category:Work', 'category:'))
      .toEqual(['category:ops']);
  });

  test('a board-only category order seeds the empty shared order once, and is not sent', async () => {
    sent.length = 0;
    activeId = 'carol';
    values.set('board.columnOrder.carol', JSON.stringify(['label:Todo', 'category:Ops', 'category:', 'assignee:0xbob', 'category:Work']));
    await adoptBoardCategoryOrder('carol');
    expect(await loadCategoryOrder('carol')).toEqual(['category:Ops', 'category:Work']);
    await applyRemoteBoardOrder('carol', ['category:Work', 'category:Ops']);
    await adoptBoardCategoryOrder('carol');
    expect(await loadCategoryOrder('carol')).toEqual(['category:Ops', 'category:Work']);
    expect(sent).toEqual([]);
  });

  test('edited empty categories retain spelling, persist and sync without changing collapsed groups', async () => {
    activeId = 'edited';
    values.set('channels.groups.edited', JSON.stringify({ collapsed: ['category:work'], order: ['category:fde', 'category:work'] }));
    await applyRemoteCategoryOrder('edited', ['category:fde', 'category:work']);
    sent.length = 0;
    setCategoryOrder(['category:FDE Team', 'category:Work', 'category:WORK', 'category:', 'label:Todo']);
    await settle();
    const order = ['category:FDE Team', 'category:Work'];
    expect(await loadCategoryOrder('edited')).toEqual(order);
    expect(JSON.parse(values.get('channels.groups.edited') ?? '{}')).toEqual({ collapsed: ['category:work'], order, orderConfigured: true });
    expect(sent).toEqual([order]);
    moveCategory('category:work', 'category:fde team', ['category:work', 'category:FDE Team']);
    await settle();
    expect(await loadCategoryOrder('edited')).toEqual(['category:Work', 'category:FDE Team']);
    expect(sections(['category:Ops', 'category:Work'])).toEqual(['Direct messages', 'Ops', 'Work', 'Alpha', 'No project']);
    setCategoryOrder(['category:Work']);
    await settle();
    expect(await loadCategoryOrder('edited')).toEqual(['category:Work']);
    sent.length = 0;
    await applyRemoteCategoryOrder('edited', ['category:Remote', 'category:Work']);
    expect(await loadCategoryOrder('edited')).toEqual(['category:Remote', 'category:Work']);
    expect(sent).toEqual([]);
  });

  test('deleting the final configured category stays empty after legacy adoption and reload', async () => {
    activeId = 'empty';
    values.set('board.columnOrder.empty', JSON.stringify(['category:Old']));
    await adoptBoardCategoryOrder('empty');
    setCategoryOrder([]);
    await settle();
    const stored = parseChannelGroupsPrefs(values.get('channels.groups.empty') ?? '{}');
    expect(stored).toEqual({ collapsed: [], order: [], orderConfigured: true });
    await adoptBoardCategoryOrder('empty');
    expect(await loadCategoryOrder('empty')).toEqual([]);
    activeId = 'other';
    await applyRemoteCategoryOrder('other', ['category:Other']);
    activeId = 'empty';
    await adoptBoardCategoryOrder('empty');
    expect(await loadCategoryOrder('empty')).toEqual([]);
  });

  test('a synced chat order is kept over the board order', async () => {
    activeId = 'dave';
    values.set('channels.groups.dave', JSON.stringify({ collapsed: [], order: ['category:work'] }));
    values.set('board.columnOrder.dave', JSON.stringify(['category:Ops', 'category:Work']));
    await adoptBoardCategoryOrder('dave');
    expect(await loadCategoryOrder('dave')).toEqual(['category:work']);
  });
});
