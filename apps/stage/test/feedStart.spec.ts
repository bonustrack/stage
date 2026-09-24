import { describe, expect, test } from 'bun:test';
import { parseFeedStarts, withFeedStart } from '../lib/feedStart.model';

describe('feed start memory', () => {
  test('adds a chat once and keeps only the most recent ones', () => {
    expect(withFeedStart(['a'], 'a')).toEqual(['a']);
    expect(withFeedStart(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
  });

  test('reads a stored list and ignores anything else', () => {
    expect(parseFeedStarts('["a","b",3]')).toEqual(['a', 'b']);
    expect(parseFeedStarts('{"a":1}')).toBeUndefined();
    expect(parseFeedStarts('not json')).toBeUndefined();
  });
});
