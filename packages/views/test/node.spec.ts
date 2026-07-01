import { describe, expect, test } from 'bun:test';
import { compact, compactList, listRoot } from '../src/node';
import { snap } from './helpers';

describe('compact', () => {
  test('drops undefined and null values', () => {
    const out = compact({ a: 1, b: undefined, c: null, d: 'x' });
    expect(out).toEqual({ a: 1, d: 'x' });
    expect(Object.keys(out)).toEqual(['a', 'd']);
  });

  test('keeps falsy but defined values', () => {
    const out = compact({ a: 0, b: '', c: false });
    expect(out).toEqual({ a: 0, b: '', c: false });
    expect(Object.keys(out)).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty object when everything is nullish', () => {
    expect(Object.keys(compact({ a: undefined, b: null }))).toEqual([]);
  });
});

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

describe('listRoot', () => {
  test('wraps a single item in a ListView', () => {
    const item = { type: 'ListViewItem' as const, children: [] };
    const root = listRoot(item);
    expect(root).toEqual({ type: 'ListView', children: [item] });
    snap(root);
  });
});
