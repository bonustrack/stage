import { describe, expect, test } from 'bun:test';
import { boardArrowMove } from '../components/board/boardKeys.model';

const column = (key: string, ...convIds: string[]): { key: string; rows: { convId: string }[] } => (
  { key, rows: convIds.map(convId => ({ convId })) }
);

const columns = [
  column('todo', 'a', 'b', 'c'),
  column('empty'),
  column('doing', 'd', 'e'),
  column('done', 'f', 'g', 'h', 'i'),
];

describe('boardArrowMove', () => {
  test('moves up and down within the column and stops at its ends', () => {
    expect(boardArrowMove(columns, 0, 'b', 'ArrowDown')).toEqual({ key: 'todo', convId: 'c' });
    expect(boardArrowMove(columns, 0, 'b', 'ArrowUp')).toEqual({ key: 'todo', convId: 'a' });
    expect(boardArrowMove(columns, 0, 'c', 'ArrowDown')).toBeNull();
    expect(boardArrowMove(columns, 0, 'a', 'ArrowUp')).toBeNull();
  });

  test('keeps the row when moving sideways and skips empty columns', () => {
    expect(boardArrowMove(columns, 0, 'b', 'ArrowRight')).toEqual({ key: 'doing', convId: 'e' });
    expect(boardArrowMove(columns, 2, 'd', 'ArrowLeft')).toEqual({ key: 'todo', convId: 'a' });
    expect(boardArrowMove(columns, 2, 'e', 'ArrowRight')).toEqual({ key: 'done', convId: 'g' });
  });

  test('lands on the last card of a shorter column', () => {
    expect(boardArrowMove(columns, 3, 'i', 'ArrowLeft')).toEqual({ key: 'doing', convId: 'e' });
    expect(boardArrowMove(columns, 0, 'c', 'ArrowRight')).toEqual({ key: 'doing', convId: 'e' });
  });

  test('stays put past the first and last columns', () => {
    expect(boardArrowMove(columns, 0, 'a', 'ArrowLeft')).toBeNull();
    expect(boardArrowMove(columns, 3, 'f', 'ArrowRight')).toBeNull();
    expect(boardArrowMove([column('only', 'a'), column('empty')], 0, 'a', 'ArrowRight')).toBeNull();
  });

  test('follows the column a card was opened from when it sits in several', () => {
    const shared = [column('bugs', 'x'), column('done', 'y', 'z'), column('design', 'w', 'x')];
    expect(boardArrowMove(shared, 2, 'x', 'ArrowLeft')).toEqual({ key: 'done', convId: 'z' });
    expect(boardArrowMove(shared, 0, 'x', 'ArrowRight')).toEqual({ key: 'done', convId: 'y' });
    expect(boardArrowMove(shared, 2, 'x', 'ArrowUp')).toEqual({ key: 'design', convId: 'w' });
  });

  test('does nothing without an open card on the board', () => {
    expect(boardArrowMove(columns, -1, null, 'ArrowDown')).toBeNull();
    expect(boardArrowMove(columns, 0, 'gone', 'ArrowDown')).toBeNull();
    expect(boardArrowMove(columns, 1, 'a', 'ArrowRight')).toBeNull();
  });
});
