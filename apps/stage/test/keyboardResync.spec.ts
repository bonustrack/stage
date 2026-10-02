import { describe, expect, test } from 'bun:test';
import { KEYBOARD_MISSES_TO_DROP, keyboardMisses } from '../components/system/KeyboardResync.model';

describe('keyboardMisses', () => {
  test('an open keyboard on a focused field clears the count', () => {
    expect(keyboardMisses(0, true, true)).toBe(0);
    expect(keyboardMisses(1, true, true)).toBe(0);
  });

  test('a hidden keyboard or no focused field counts a miss', () => {
    expect(keyboardMisses(0, false, true)).toBe(1);
    expect(keyboardMisses(0, true, false)).toBe(1);
    expect(keyboardMisses(0, false, false)).toBe(1);
  });

  test('the lift drops only after misses in a row', () => {
    const once = keyboardMisses(0, false, false);
    expect(once).toBeLessThan(KEYBOARD_MISSES_TO_DROP);
    expect(keyboardMisses(once, true, false)).toBe(KEYBOARD_MISSES_TO_DROP);
    expect(keyboardMisses(keyboardMisses(once, true, true), false, true)).toBeLessThan(KEYBOARD_MISSES_TO_DROP);
  });
});
