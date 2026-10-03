import { describe, expect, test } from 'bun:test';
import { movedKey, movedPinOrder, pinOrderAfterRemote, savedFirst, toggledPinOrder } from '../src/xmtp/pinOrder';

describe('pin order', () => {
  test('a new pin goes to the top, unpinning removes it', () => {
    expect(toggledPinOrder(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    expect(toggledPinOrder(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('moving clamps to the list and is a no-op for unknown ids or same index', () => {
    const order = ['a', 'b', 'c'];
    expect(movedPinOrder(order, 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(movedPinOrder(order, 'c', -5)).toEqual(['c', 'a', 'b']);
    expect(movedPinOrder(order, 'b', 99)).toEqual(['a', 'c', 'b']);
    expect(movedPinOrder(order, 'b', 1)).toBe(order);
    expect(movedPinOrder(order, 'zz', 0)).toBe(order);
  });

  test('a remote message with an order replaces the list, a legacy one toggles', () => {
    expect(pinOrderAfterRemote(['a'], { convId: 'b', pinned: true, order: ['b', 'a'] })).toEqual(['b', 'a']);
    expect(pinOrderAfterRemote(['a'], { convId: 'b', pinned: true })).toEqual(['b', 'a']);
    expect(pinOrderAfterRemote(['a', 'b'], { convId: 'a', pinned: false })).toEqual(['b']);
    const same = ['a'];
    expect(pinOrderAfterRemote(same, { convId: 'a', pinned: true })).toBe(same);
  });

  test('saved keys come first in saved order, the rest keep the given order or the tie-break', () => {
    const id = (key: string): string => key;
    expect(savedFirst(['a', 'b', 'c', 'd'], ['c', 'x', 'a', 'c'], id)).toEqual(['c', 'a', 'b', 'd']);
    expect(savedFirst(['d', 'b', 'a'], [], id, (x, y) => x.localeCompare(y))).toEqual(['a', 'b', 'd']);
  });

  test('a moved key takes the place of its target', () => {
    expect(movedKey(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(movedKey(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });
});
