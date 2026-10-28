import { describe, expect, test } from 'bun:test';
import {
  indicatorRect, insertionIndex, isNoMove, listAt, moveAnchor, movedItems, nearestList, shiftOf, slotAt, sortMove, stepTarget, unionRect,
  type SortListLayout,
} from '../src/sortable';

const row = (id: string, y: number): { id: string; rect: { x: number; y: number; width: number; height: number } } => ({ id, rect: { x: 0, y, width: 100, height: 20 } });

const todo: SortListLayout = { listId: 'todo', direction: 'vertical', rect: { x: 0, y: 0, width: 100, height: 200 }, ids: ['a', 'b', 'c'], items: [row('a', 0), row('b', 30), row('c', 60)] };
const done: SortListLayout = { listId: 'done', direction: 'vertical', rect: { x: 120, y: 0, width: 100, height: 200 }, ids: ['d'], items: [{ id: 'd', rect: { x: 120, y: 0, width: 100, height: 20 } }] };

describe('sortable model', () => {
  test('finds the innermost list under the pointer and the insertion index without the dragged item', () => {
    expect(listAt([todo, done], 130, 50)?.listId).toBe('done');
    expect(listAt([todo, done], 500, 50)).toBeUndefined();
    expect(insertionIndex(todo, 'a', 50, 45)).toBe(1);
    expect(insertionIndex(todo, 'a', 50, 200)).toBe(2);
    expect(insertionIndex(todo, 'c', 50, 5)).toBe(0);
  });

  test('a move names its neighbours in the target list, null at the ends', () => {
    expect(sortMove({ itemId: 'a', listId: 'todo', index: 0 }, todo, 1)).toEqual({
      itemId: 'a', fromListId: 'todo', toListId: 'todo', fromIndex: 0, toIndex: 1, beforeId: 'b', afterId: 'c',
    });
    const across = sortMove({ itemId: 'b', listId: 'todo', index: 1 }, done, 1);
    expect([across.beforeId, across.afterId, across.toListId]).toEqual(['d', null, 'done']);
    expect(isNoMove(sortMove({ itemId: 'b', listId: 'todo', index: 1 }, todo, 1))).toBe(true);
  });

  test('keyboard steps stay inside the list and jump to neighbouring lists', () => {
    expect(stepTarget([todo, done], 'a', { listId: 'todo', index: 0 }, 'backward')).toEqual({ listId: 'todo', index: 0 });
    expect(stepTarget([todo, done], 'a', { listId: 'todo', index: 2 }, 'forward')).toEqual({ listId: 'todo', index: 2 });
    expect(stepTarget([todo, done], 'a', { listId: 'todo', index: 2 }, 'nextList')).toEqual({ listId: 'done', index: 1 });
    expect(stepTarget([todo, done], 'a', { listId: 'todo', index: 1 }, 'previousList')).toEqual({ listId: 'todo', index: 1 });
  });

  test('the indicator sits between the neighbours, relative to the list', () => {
    expect(indicatorRect(todo, 'a', 1, 2)).toEqual({ x: 0, y: 54, width: 100, height: 2 });
    expect(indicatorRect(todo, 'a', 0, 2)).toEqual({ x: 0, y: 29, width: 100, height: 2 });
    const tight = { ...todo, rect: { x: 0, y: 0, width: 100, height: 80 } };
    expect(indicatorRect(tight, 'a', 2, 2)).toEqual({ x: 0, y: 78, width: 100, height: 2 });
    expect(indicatorRect({ ...tight, ids: [], items: [] }, 'a', 0, 2)).toEqual({ x: 0, y: 0, width: 100, height: 2 });
  });

  test('items move inside a list or across two lists', () => {
    expect(movedItems(['a', 'b', 'c'], null, 0, 2)).toEqual({ source: ['b', 'c', 'a'], target: ['b', 'c', 'a'] });
    expect(movedItems(['a', 'b'], ['x'], 1, 0)).toEqual({ source: ['a'], target: ['b', 'x'] });
    expect(movedItems(['a'], ['x'], 5, 0)).toEqual({ source: ['a'], target: ['x'] });
  });

  test('a virtualized list counts the rows that are not rendered from the ids', () => {
    const long: SortListLayout = {
      listId: 'long', direction: 'vertical', rect: { x: 0, y: 0, width: 100, height: 100 },
      ids: ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'], items: [row('r4', 0), row('r5', 30), row('r6', 60)],
    };
    expect(insertionIndex(long, 'r5', 50, 5)).toBe(4);
    expect(insertionIndex(long, 'r5', 50, 95)).toBe(6);
    expect(sortMove({ itemId: 'r5', listId: 'long', index: 5 }, long, 4)).toEqual({
      itemId: 'r5', fromListId: 'long', toListId: 'long', fromIndex: 5, toIndex: 4, beforeId: 'r3', afterId: 'r4',
    });
  });

  test('items between the old and new place slide by the moved size', () => {
    expect([0, 1, 2, 3, 4].map(i => shiftOf(i, 1, 3, 20))).toEqual([0, 0, -20, -20, 0]);
    expect([0, 1, 2, 3, 4].map(i => shiftOf(i, 3, 1, 20))).toEqual([0, 20, 20, 0, 0]);
  });

  test('the anchor is the neighbour the item took the place of', () => {
    expect(moveAnchor({ fromIndex: 0, toIndex: 2, beforeId: 'c', afterId: 'd' })).toBe('c');
    expect(moveAnchor({ fromIndex: 3, toIndex: 1, beforeId: 'a', afterId: 'b' })).toBe('b');
  });

  test('outside every list the pointer falls to the nearest list across it', () => {
    const short = { ...done, rect: { ...done.rect, height: 40 } };
    expect(nearestList([todo, short], 130, 300)?.listId).toBe('done');
    expect(nearestList([todo, short], 50, -20)?.listId).toBe('todo');
    expect(nearestList([todo, short], 110, 300)).toBeUndefined();
    expect(insertionIndex(short, 'a', 130, 300)).toBe(1);
    expect(nearestList([todo, short], 130, 300, 48)).toBeUndefined();
    expect(nearestList([todo, short], 130, 70, 48)?.listId).toBe('done');
  });

  test('the preview slot names the items around it', () => {
    expect(slotAt('todo', ['a', 'b', 'c'], 'a', 1)).toEqual({ listId: 'todo', beforeId: 'b', afterId: 'c' });
    expect(slotAt('done', ['d'], 'a', 1)).toEqual({ listId: 'done', beforeId: 'd', afterId: null });
    expect(slotAt('empty', [], 'a', 0)).toEqual({ listId: 'empty', beforeId: null, afterId: null });
  });

  test('a block measures as the union of its rows', () => {
    expect(unionRect([row('a', 0).rect, null, row('b', 30).rect])).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(unionRect([null])).toBeNull();
  });
});
