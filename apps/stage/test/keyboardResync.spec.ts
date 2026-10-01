import { describe, expect, test } from 'bun:test';
import { keyboardLiftIsStale } from '../components/system/KeyboardResync.model';

describe('keyboardLiftIsStale', () => {
  test('a hidden keyboard that still lifts the composer is stale', () => {
    expect(keyboardLiftIsStale(false, -288, 0.8)).toBe(true);
    expect(keyboardLiftIsStale(false, -288, 1)).toBe(true);
    expect(keyboardLiftIsStale(false, 0, 1)).toBe(true);
  });

  test('an open keyboard or a composer already at the bottom is left alone', () => {
    expect(keyboardLiftIsStale(true, -288, 1)).toBe(false);
    expect(keyboardLiftIsStale(true, 0, 0)).toBe(false);
    expect(keyboardLiftIsStale(false, 0, 0)).toBe(false);
  });
});
