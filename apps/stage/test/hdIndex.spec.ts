import { describe, expect, test } from 'bun:test';
import { nextHdIndex } from '@stage-labs/client/accounts/hdIndex';

describe('nextHdIndex', () => {
  test('never reuses an index below the high-water mark, even after deletions', () => {
    expect(nextHdIndex([0], null)).toBe(1);
    expect(nextHdIndex([0], 2)).toBe(2);
    expect(nextHdIndex([], 3)).toBe(3);
  });

  test('starts at zero on a fresh device and skips gaps in the live list', () => {
    expect(nextHdIndex([], null)).toBe(0);
    expect(nextHdIndex([0, 2], null)).toBe(3);
  });
});
