import { describe, expect, test } from 'bun:test';
import {
  indicatorRect, insertionIndex, isNoMove, listAt, movedItems, sortMove, stepTarget, type SortListLayout,
} from '../src/sortable';

const row = (id: string, y: number): { id: string; rect: { x: number; y: number; width: number; height: number } } => ({ id, rect: { x: 0, y, width: 100, height: 20 } });

const todo: SortListLayout = { listId: 'todo', direction: 'vertical', rect: { x: 0, y: 0, width: 100, height: 200 }, items: [row('a', 0), row('b', 30), row('c', 60)] };
const done: SortListLayout = { listId: 'done', direction: 'vertical', rect: { x: 120, y: 0, width: 100, height: 200 }, items: [{ id: 'd', rect: { x: 120, y: 0, width: 100, height: 20 } }] };

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
  });

  test('items move inside a list or across two lists', () => {
    expect(movedItems(['a', 'b', 'c'], null, 0, 2)).toEqual({ source: ['b', 'c', 'a'], target: ['b', 'c', 'a'] });
    expect(movedItems(['a', 'b'], ['x'], 1, 0)).toEqual({ source: ['a'], target: ['b', 'x'] });
    expect(movedItems(['a'], ['x'], 5, 0)).toEqual({ source: ['a'], target: ['x'] });
  });
});
