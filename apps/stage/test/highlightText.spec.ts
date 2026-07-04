import { describe, expect, test } from 'bun:test';
import { highlightSegments } from '../views/chat/highlightText';

describe('highlightSegments', () => {
  test('empty query yields one non-match segment', () => {
    expect(highlightSegments('Hello', '')).toEqual([{ value: 'Hello', match: false }]);
  });

  test('case-insensitive matching splits around matches', () => {
    expect(highlightSegments('Hello hello world', 'hello')).toEqual([
      { value: 'Hello', match: true },
      { value: ' ', match: false },
      { value: 'hello', match: true },
      { value: ' world', match: false },
    ]);
  });

  test('no match yields the whole text as one segment', () => {
    expect(highlightSegments('plain text', 'needle')).toEqual([
      { value: 'plain text', match: false },
    ]);
  });

  test('match preserves original casing of the source text', () => {
    expect(highlightSegments('find the Needle here', 'needle')).toEqual([
      { value: 'find the ', match: false },
      { value: 'Needle', match: true },
      { value: ' here', match: false },
    ]);
  });
});
