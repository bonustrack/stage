import { describe, expect, test } from 'bun:test';
import { movedPinOrder, pinOrderAfterRemote, pinRank, toggledPinOrder } from '../src/xmtp/pinOrder';

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

  test('rank maps ids to their position', () => {
    expect([...pinRank(['x', 'y']).entries()]).toEqual([['x', 0], ['y', 1]]);
  });
});
