import { describe, expect, test } from 'bun:test';
import { groupRows } from '../components/home/groups.model';
import { NO_HOME_DRAG, homeDragModel, pinMove, sectionMove, zoneAt, zoneMove } from '../components/home/listDrag.model';
import type { Row } from '../components/home/model';
import { groupHeaderId as header } from '../lib/grouping.model';
import { row } from './rowFixture';

const dm = row('dm', { peerAddress: '0xabc' });
const work = row('work', { category: 'Work', labels: ['Todo'] });
const work2 = row('work2', { category: 'work', labels: ['Done'] });
const alpha = row('alpha', { category: 'Alpha', labels: ['Done'] });
const loose = row('loose');
const nameOf = (address: string): string => address;
const byProject = (rows: Row[], folded: string[] = []) => homeDragModel(groupRows(rows, 'category', new Set(folded), false, nameOf), true);
const move = (itemId: string, fromIndex: number, toIndex: number, beforeId: string | null, afterId: string | null) => ({
  itemId,
  fromListId: 'l',
  toListId: 'l',
  fromIndex,
  toIndex,
  beforeId,
  afterId,
});

describe('dragging project sections', () => {
  test('every project section is a block, direct messages and no project included, and rows follow their header', () => {
    const model = byProject([dm, work, work2, alpha, loose], ['category:work']);
    expect(model.sections).toEqual([header('dm'), header('category:alpha'), header('category:work'), header('none')]);
    expect([...model.sectionKeys.values()]).toEqual(['dm', 'category:alpha', 'category:work', 'none']);
    expect(model.sectionOf.get('alpha')).toBe(header('category:alpha'));
    expect(model.sectionOf.get('dm')).toBe(header('dm'));
    expect(model.sectionOf.get('loose')).toBe(header('none'));
    expect(model.sectionOf.has('work')).toBe(false);
  });

  test('other groupings and the flat list have nothing to drag', () => {
    expect(homeDragModel(groupRows([work, alpha], 'label', new Set(), false, nameOf), true).sections).toEqual([]);
    expect(homeDragModel(groupRows([work, alpha], 'category', new Set(), false, nameOf), false)).toEqual(NO_HOME_DRAG);
  });

  test('a section takes the place of the section it passes', () => {
    const model = byProject([dm, work, alpha, loose]);
    expect(sectionMove(model, move(header('category:work'), 2, 0, null, header('dm')))).toEqual({
      key: 'category:work',
      target: 'dm',
      visible: ['dm', 'category:alpha', 'category:work', 'none'],
    });
    expect(sectionMove(model, move(header('dm'), 0, 3, header('none'), null))?.target).toBe('none');
    expect(sectionMove(model, move('alpha', 1, 2, header('category:work'), null))).toBeNull();
  });

  test('a pinned chat takes the place of the pinned chat it passes', () => {
    expect(pinMove(['a', 'b', 'c'], move('a', 0, 1, 'b', 'c'))).toBe(1);
    expect(pinMove(['a', 'b', 'c'], move('c', 2, 0, null, 'a'))).toBe(0);
    expect(pinMove(['a', 'b'], move('a', 0, 1, 'gone', null))).toBeNull();
  });
});

describe('moving a chat to another project', () => {
  const model = byProject([dm, work, work2, alpha, loose]);

  test('every header and row has a place, tagged with the section it drops into, direct messages excluded', () => {
    expect(model.rows).toEqual([
      header('dm'),
      'dm',
      header('category:alpha'),
      'alpha',
      header('category:work'),
      'work',
      'work2',
      header('none'),
      'loose',
    ]);
    expect([...model.zoneOf]).toEqual([
      [header('category:alpha'), header('category:alpha')],
      ['alpha', header('category:alpha')],
      [header('category:work'), header('category:work')],
      ['work', header('category:work')],
      ['work2', header('category:work')],
      [header('none'), header('none')],
      ['loose', header('none')],
    ]);
    expect([...model.categories]).toEqual([
      [header('category:alpha'), 'Alpha'],
      [header('category:work'), 'Work'],
      [header('none'), null],
    ]);
  });

  test('the target is the section of the place above the drop point', () => {
    expect(zoneAt(model, 'work2', 4)).toBe(header('category:alpha'));
    expect(zoneAt(model, 'work2', 7)).toBe(header('none'));
    expect(zoneAt(model, 'loose', 4)).toBe(header('category:alpha'));
    expect(zoneMove(model, move('work2', 6, 4, 'alpha', header('category:work')))).toEqual({ convId: 'work2', category: 'Alpha' });
    expect(zoneMove(model, move('work2', 6, 7, header('none'), 'loose'))).toEqual({ convId: 'work2', category: null });
  });

  test('its own section and the direct messages are no target', () => {
    expect(zoneAt(model, 'work2', 6)).toBeUndefined();
    expect(zoneAt(model, 'work2', 0)).toBeUndefined();
    expect(zoneAt(model, 'work2', 2)).toBeUndefined();
    expect(zoneMove(model, move('work2', 6, 5, header('category:work'), 'work'))).toBeNull();
  });

  test('a folded section takes a drop on its header', () => {
    const folded = byProject([work, alpha], ['category:work']);
    expect(folded.rows).toEqual([header('category:alpha'), 'alpha', header('category:work')]);
    expect(zoneAt(folded, 'alpha', 2)).toBe(header('category:work'));
  });
});
