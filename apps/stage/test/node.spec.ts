import { describe, expect, test } from 'bun:test';
import { compactList } from '../components/ChannelMenu.model';

describe('compactList', () => {
  test('filters undefined and null entries', () => {
    expect(compactList(['a', undefined, null, 'b'])).toEqual(['a', 'b']);
  });

  test('keeps falsy but defined entries', () => {
    expect(compactList([0, '', false, undefined])).toEqual([0, '', false]);
  });

  test('returns an empty list for all-nullish input', () => {
    expect(compactList([undefined, null])).toEqual([]);
  });
});
