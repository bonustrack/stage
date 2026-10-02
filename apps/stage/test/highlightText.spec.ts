import { describe, expect, test } from 'bun:test';
import { highlightSegments } from '../components/HighlightText.model';

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

  test('matches across a link label and a channel name in a named plain body', () => {
    const body = 'read [ping @Chen](https://example.com) today #Ops';
    expect(highlightSegments(body, 'today #Ops').filter(s => s.match).map(s => s.value)).toEqual(['today #Ops']);
    expect(highlightSegments(body, 'example.com) today').filter(s => s.match).map(s => s.value)).toEqual(['example.com) today']);
  });
});
