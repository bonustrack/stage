import { describe, expect, test } from 'bun:test';
import { callGrid, callSubtitle } from '../components/call/CallScreen.model';

describe('call screen model', () => {
  test('lays tiles out in a near-square grid on wide screens and two columns on phones', () => {
    expect(callGrid(1, true)).toEqual({ cols: 1, rows: 1 });
    expect(callGrid(2, true)).toEqual({ cols: 2, rows: 1 });
    expect(callGrid(3, true)).toEqual({ cols: 2, rows: 2 });
    expect(callGrid(8, true)).toEqual({ cols: 3, rows: 3 });
    expect(callGrid(2, false)).toEqual({ cols: 1, rows: 2 });
    expect(callGrid(5, false)).toEqual({ cols: 2, rows: 3 });
    expect(callGrid(0, false)).toEqual({ cols: 1, rows: 1 });
  });

  test('formats the header line with the call duration', () => {
    expect(callSubtitle(0, 9_000)).toBe('Calling…');
    expect(callSubtitle(2, 61_000)).toBe('3 people · 1:01');
    expect(callSubtitle(1, 3_725_000)).toBe('2 people · 1:02:05');
  });
});
