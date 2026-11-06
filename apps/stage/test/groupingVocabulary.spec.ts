import { describe, expect, test } from 'bun:test';
import {
  groupHeaderId,
  groupKeyOf,
  groupValueOf,
  groupingOrderOf,
  groupingOrderStore,
  isNamedGroupKey,
  sectionKeyOf,
} from '../lib/grouping.model';

describe('grouping vocabulary', () => {
  test('saved order keys keep the value as typed and section keys lower it', () => {
    expect(groupKeyOf('label', 'To Do')).toBe('label:To Do');
    expect(groupKeyOf('status', '')).toBe('status:');
    expect(sectionKeyOf('category', 'Work')).toBe('category:work');
    expect(groupHeaderId(sectionKeyOf('status', 'Done'))).toBe('group:status:done');
  });

  test('reads the value back only from a key of the same grouping', () => {
    expect(groupValueOf('status', 'status:Done')).toBe('Done');
    expect(groupValueOf('status', 'label:Done')).toBeNull();
    expect(isNamedGroupKey('category', 'category:')).toBe(false);
    expect(isNamedGroupKey('category', 'category:Work')).toBe(true);
  });

  test('projects keep their order with the channel groups, every other grouping with the board', () => {
    const orders = { categories: ['category:work'], board: ['status:Done'] };
    expect(groupingOrderStore('category')).toBe('categories');
    expect(groupingOrderOf('category', orders)).toBe(orders.categories);
    for (const by of ['status', 'label', 'assignee'] as const) expect(groupingOrderOf(by, orders)).toBe(orders.board);
  });
});
