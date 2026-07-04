
import { describe, expect, it } from 'bun:test';
import { deepValueEquals, reconcileMapValues } from '../lib/mapReconcile';

describe('deepValueEquals', () => {
  it('compares primitives by value', () => {
    expect(deepValueEquals(1, 1)).toBe(true);
    expect(deepValueEquals('a', 'b')).toBe(false);
    expect(deepValueEquals(null, null)).toBe(true);
    expect(deepValueEquals(null, {})).toBe(false);
  });

  it('compares sets by membership', () => {
    expect(deepValueEquals(new Set(['x', 'y']), new Set(['y', 'x']))).toBe(true);
    expect(deepValueEquals(new Set(['x']), new Set(['x', 'y']))).toBe(false);
    expect(deepValueEquals(new Set(['x']), ['x'])).toBe(false);
  });

  it('compares arrays element-wise in order', () => {
    expect(deepValueEquals(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(deepValueEquals(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('compares nested maps recursively', () => {
    const a = new Map([[0, new Map([[1, new Set(['u1'])]])]]);
    const b = new Map([[0, new Map([[1, new Set(['u1'])]])]]);
    const c = new Map([[0, new Map([[1, new Set(['u2'])]])]]);
    expect(deepValueEquals(a, b)).toBe(true);
    expect(deepValueEquals(a, c)).toBe(false);
  });

  it('compares plain records by keys and values', () => {
    expect(deepValueEquals({ text: 'hi', ts: '1' }, { text: 'hi', ts: '1' })).toBe(true);
    expect(deepValueEquals({ text: 'hi' }, { text: 'hi', ts: '1' })).toBe(false);
    expect(deepValueEquals({ text: 'hi' }, { text: 'yo' })).toBe(false);
  });
});

describe('reconcileMapValues', () => {
  it('returns prev when content is unchanged', () => {
    const prev = new Map([['m1', new Map([['👍', 2]])]]);
    const next = new Map([['m1', new Map([['👍', 2]])]]);
    expect(reconcileMapValues(prev, next)).toBe(prev);
  });

  it('keeps prev value references for untouched keys', () => {
    const untouched = new Map([['👍', 2]]);
    const prev = new Map([['m1', untouched], ['m2', new Map([['🔥', 1]])]]);
    const next = new Map([['m1', new Map([['👍', 2]])], ['m2', new Map([['🔥', 3]])]]);
    const out = reconcileMapValues(prev, next);
    expect(out).not.toBe(prev);
    expect(out.get('m1')).toBe(untouched);
    expect(out.get('m2')).toBe(next.get('m2'));
  });

  it('handles added and removed keys', () => {
    const kept = new Set(['a']);
    const prev = new Map([['m1', kept], ['m2', new Set(['b'])]]);
    const next = new Map([['m1', new Set(['a'])], ['m3', new Set(['c'])]]);
    const out = reconcileMapValues(prev, next);
    expect(out.get('m1')).toBe(kept);
    expect(out.has('m2')).toBe(false);
    expect(out.get('m3')).toBe(next.get('m3'));
    expect(out.size).toBe(2);
  });

  it('returns next when prev is the same reference', () => {
    const next = new Map([['m1', 1]]);
    expect(reconcileMapValues(next, next)).toBe(next);
  });

  it('reconciles empty maps to prev identity', () => {
    const prev = new Map<string, number>();
    const next = new Map<string, number>();
    expect(reconcileMapValues(prev, next)).toBe(prev);
  });
});
