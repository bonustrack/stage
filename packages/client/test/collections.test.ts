import { describe, expect, test } from 'bun:test';
import { uniqueBy } from '../src/collections';

describe('uniqueBy', () => {
  test('keeps the first row for each id', () => {
    const rows = [
      { convId: 'a', n: 1 },
      { convId: 'b', n: 2 },
      { convId: 'a', n: 3 },
    ];
    expect(uniqueBy(rows, (row) => row.convId)).toEqual([
      { convId: 'a', n: 1 },
      { convId: 'b', n: 2 },
    ]);
  });
});
