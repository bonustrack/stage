import { describe, expect, test } from 'bun:test';
import { initialMenuAnchor } from '../components/MessengerBubble.anchor';

describe('initialMenuAnchor', () => {
  test('fresh bubble (never measured) waits for measurement instead of opening at y:0', () => {
    expect(initialMenuAnchor({ y: 0, height: 0 }, true)).toBeNull();
  });

  test('valid cached anchor is reused for an immediate open', () => {
    const cached = { y: 320, height: 48 };
    expect(initialMenuAnchor(cached, true)).toBe(cached);
  });

  test('no node to measure falls back to the cached anchor', () => {
    const cached = { y: 0, height: 0 };
    expect(initialMenuAnchor(cached, false)).toBe(cached);
  });

  test('non-zero cached height counts as valid even at y:0', () => {
    const cached = { y: 0, height: 40 };
    expect(initialMenuAnchor(cached, true)).toBe(cached);
  });
});
