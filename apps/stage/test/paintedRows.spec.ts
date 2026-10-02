import { describe, expect, test } from 'bun:test';
import { mergePaintedRows } from '../components/home/model';

const row = (convId: string, lastTs: number): { convId: string; lastTs: number } => ({ convId, lastTs });

describe('a chat list paint keeps changes made while it ran', () => {
  test('a plain paint replaces the rows, newest first', () => {
    const painted = [row('a', 1), row('b', 3)];
    expect(mergePaintedRows(['a', 'b'], [row('a', 1), row('b', 2)], painted)).toEqual([row('b', 3), row('a', 1)]);
  });

  test('a chat left or rejected during the paint stays out', () => {
    const painted = [row('a', 2), row('left', 9)];
    expect(mergePaintedRows(['a', 'left'], [row('a', 1)], painted)).toEqual([row('a', 2)]);
  });

  test('a chat that arrived during the paint stays in, and a chat new to this paint is added', () => {
    const painted = [row('a', 1), row('fresh', 2)];
    expect(mergePaintedRows(['a'], [row('new', 5), row('a', 1)], painted)).toEqual([row('new', 5), row('fresh', 2), row('a', 1)]);
  });
});
