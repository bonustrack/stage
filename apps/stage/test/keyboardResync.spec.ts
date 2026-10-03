import { describe, expect, test } from 'bun:test';
import { KEYBOARD_MISSES_TO_DROP, keyboardMisses } from '../components/system/KeyboardResync.model';

describe('keyboardMisses', () => {
  test('an open keyboard clears the count whatever the field and the app did', () => {
    expect(keyboardMisses(0, true, true, false)).toBe(0);
    expect(keyboardMisses(1, true, false, false)).toBe(0);
    expect(keyboardMisses(1, true, true, true)).toBe(0);
  });

  test('a focused field in a foreground app is trusted when the keyboard goes unreported', () => {
    expect(keyboardMisses(0, false, true, false)).toBe(0);
    expect(keyboardMisses(1, false, true, false)).toBe(0);
  });

  test('an unreported keyboard counts a miss once the field lost focus or the app was paused', () => {
    expect(keyboardMisses(0, false, false, false)).toBe(1);
    expect(keyboardMisses(0, false, true, true)).toBe(1);
    expect(keyboardMisses(0, false, false, true)).toBe(1);
  });

  test('the lift drops only after misses in a row', () => {
    const once = keyboardMisses(0, false, false, false);
    expect(once).toBeLessThan(KEYBOARD_MISSES_TO_DROP);
    expect(keyboardMisses(once, false, true, true)).toBe(KEYBOARD_MISSES_TO_DROP);
    expect(keyboardMisses(keyboardMisses(once, true, true, true), false, true, true)).toBeLessThan(KEYBOARD_MISSES_TO_DROP);
  });
});
