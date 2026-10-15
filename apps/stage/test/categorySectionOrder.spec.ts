import { describe, expect, test } from 'bun:test';
import {
  addedColumnOrder, boardColumns, deletedColumnOrder, keptColumnOrder, orderedColumns, renamedColumnOrder,
} from '../components/board/BoardScreen.model';
import { groupRows, isGroupHeader } from '../components/home/groups.model';
import { sectionBlocks } from '../components/home/listDrag.model';
import type { Row } from '../components/home/model';
import { categoryOrderWith, categorySectionKeysOf, categorySectionOrderWith, movedCategoryOrder } from '../lib/channelGroups.model';

function row(convId: string, extra: Partial<Row> = {}): Row {
  return {
    convId, title: convId, lastTs: 1, lastBubbleTs: 1, lastPreview: '', avatarAddress: null, avatarUri: null,
    peerAddress: null, lastSenderAddress: null, lastFromSelf: false, inboxToAddr: {}, unreadCount: 0, lastReadNs: 0,
    markedUnread: false, selfInboxId: 'me', labels: [], category: null, assigned: [], consent: null, ...extra,
  };
}

const direct = row('direct', { peerAddress: '0xabc' });
const alpha = row('alpha', { category: 'Alpha', labels: ['Todo'] });
const work = row('work', { category: 'Work', labels: ['Done'] });
const loose = row('loose');
const rows = [direct, alpha, work, loose];
const sections = (order: readonly string[], selected = rows): string[] => (
  groupRows(selected, 'category', new Set(), false, value => value, order).filter(isGroupHeader).map(item => item.header.key)
);

describe('category section ordering', () => {
  test('project grouping and reordering work without toSorted and do not mutate inputs', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'toSorted');
    Object.defineProperty(Array.prototype, 'toSorted', { configurable: true, value: undefined });
    try {
      const visible = Object.freeze(['category:work', 'category:alpha']);
      const legacy = Object.freeze(['category:work', 'category:hidden']);
      const reordered = Object.freeze(['none', 'category:work', 'dm', 'category:alpha']);
      expect(sections([], [])).toEqual([]);
      expect(sections([])).toEqual(['dm', 'category:alpha', 'category:work', 'none']);
      expect(categoryOrderWith(legacy, visible)).toEqual(['category:work', 'category:hidden', 'category:alpha']);
      expect(sections(legacy)).toEqual(['dm', 'category:work', 'category:alpha', 'none']);
      expect(sections(reordered)).toEqual(reordered);
      expect(sections(reordered, [work, alpha])).toEqual(['category:work', 'category:alpha']);
      expect(movedCategoryOrder(reordered, ['none', ...visible, 'dm'], 'dm', 'none'))
        .toEqual(['dm', 'none', 'category:work', 'category:alpha']);
      expect(visible).toEqual(['category:work', 'category:alpha']);
      expect(legacy).toEqual(['category:work', 'category:hidden']);
      expect(reordered).toEqual(['none', 'category:work', 'dm', 'category:alpha']);
    } finally {
      if (descriptor) Object.defineProperty(Array.prototype, 'toSorted', descriptor);
      else Reflect.deleteProperty(Array.prototype, 'toSorted');
    }
  });

  test('legacy orders keep direct messages first and no project last without mutating the saved order', () => {
    const legacy = ['category:work', 'category:hidden'];
    expect(sections(legacy)).toEqual(['dm', 'category:work', 'category:alpha', 'none']);
    expect(categorySectionOrderWith(legacy, ['category:alpha', 'category:work']))
      .toEqual(['dm', 'category:work', 'category:hidden', 'category:alpha', 'none']);
    expect(legacy).toEqual(['category:work', 'category:hidden']);
  });

  test('each built-in can move above, between or below named projects', () => {
    const visible = ['dm', 'category:alpha', 'category:work', 'none'];
    const directLast = movedCategoryOrder([], visible, 'dm', 'none');
    expect(sections(directLast)).toEqual(['category:alpha', 'category:work', 'none', 'dm']);
    const noProjectFirst = movedCategoryOrder(directLast, sections(directLast), 'none', 'category:alpha');
    expect(sections(noProjectFirst)).toEqual(['none', 'category:alpha', 'category:work', 'dm']);
    const between = movedCategoryOrder(noProjectFirst, sections(noProjectFirst), 'dm', 'category:work');
    expect(sections(between)).toEqual(['none', 'category:alpha', 'dm', 'category:work']);
  });

  test('missing and filtered sections keep their saved positions when they return', () => {
    const order = ['none', 'category:work', 'dm', 'category:hidden', 'category:alpha'];
    expect(sections(order, [alpha, work])).toEqual(['category:work', 'category:alpha']);
    const changed = movedCategoryOrder(order, ['category:work', 'category:alpha'], 'category:alpha', 'category:work');
    expect(changed).toEqual(['none', 'category:alpha', 'category:work', 'dm', 'category:hidden']);
    expect(sections(changed)).toEqual(['none', 'category:alpha', 'category:work', 'dm']);
    expect(sections(changed, [...rows, row('hidden', { category: 'Hidden' })]))
      .toEqual(['none', 'category:alpha', 'category:work', 'dm', 'category:hidden']);
    expect(movedCategoryOrder([], ['category:work', 'none'], 'none', 'category:work'))
      .toEqual(['dm', 'none', 'category:work']);
  });

  test('built-in identities do not collide with project names or become project choices', () => {
    const named = row('named', { category: 'No project' });
    const namedDirect = row('named-direct', { category: 'Direct messages' });
    const order = ['none', 'category:no project', 'dm', 'category:direct messages'];
    expect(sections(order, [direct, loose, named, namedDirect])).toEqual(order);
    expect(categorySectionKeysOf(['dm', 'none', 'category:Work', 'category:work', 'label:Todo', 'category:']))
      .toEqual(['dm', 'none', 'category:Work']);
    expect(movedCategoryOrder(order, order, 'label:Todo', 'dm')).toEqual(order);
  });

  test('other grouping modes ignore the project section order', () => {
    const items = groupRows(rows, 'label', new Set(), false, value => value, ['none', 'dm', 'category:work']);
    expect(items.filter(isGroupHeader).map(item => item.header.key)).toEqual(['dm', 'label:done', 'label:todo', 'none']);
  });

  test('collapsed built-ins are still full-section reorder targets', () => {
    const items = groupRows(rows, 'category', new Set(['dm', 'none']), false, value => value);
    const blocks = sectionBlocks(items, 40, 67, new Map([['alpha', 90], ['work', 110]]));
    expect(blocks.ids).toEqual(['dm', 'category:alpha', 'category:work', 'none']);
    expect(blocks.heights).toEqual([40, 130, 150, 40]);
    expect(blocks.blockOf.get('group:none')).toBe(3);
    expect(blocks.blockOf.has('loose')).toBe(false);
  });
});

describe('shared project order with Board', () => {
  const saved = ['none', 'category:Work', 'dm', 'category:Alpha'];
  const shown = ['category:Work', 'category:Alpha', 'category:'];

  test('Board still excludes direct messages and fixes its catch-all after named projects', () => {
    const columns = orderedColumns(boardColumns(rows, [], saved, 'category'), saved);
    expect(columns.map(column => column.key)).toEqual(['category:Work', 'category:Alpha', 'category:']);
    expect(columns.flatMap(column => column.rows.map(item => item.convId))).not.toContain('direct');
  });

  test('Board add, rename, delete and emptied-column writes retain built-in section positions', () => {
    expect(categorySectionKeysOf(addedColumnOrder(shown, saved, 'New', 'category')))
      .toEqual([...saved, 'category:New']);
    expect(categorySectionKeysOf(renamedColumnOrder(shown, saved, 'Work', 'Renamed', 'category')))
      .toEqual(['none', 'category:Renamed', 'dm', 'category:Alpha']);
    expect(categorySectionKeysOf(deletedColumnOrder(shown, saved, 'Alpha', 'category')))
      .toEqual(['none', 'category:Work', 'dm']);
    const columns = boardColumns(rows, [], saved, 'category');
    const kept = keptColumnOrder(columns, saved, 'category:Work');
    expect(kept === null ? saved : categorySectionKeysOf(kept)).toEqual(saved);
    expect(movedCategoryOrder(saved, shown, 'category:Work', 'category:Alpha'))
      .toEqual(['none', 'dm', 'category:Alpha', 'category:Work']);
  });
});
