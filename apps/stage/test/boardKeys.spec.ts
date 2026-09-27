import { describe, expect, test } from 'bun:test';
import {
  boardArrowMove, boardArrowOf, revealScrollDelta, type BoardKeyEvent, type BoardKeyTarget,
} from '../components/board/boardKeys.model';

const press = (key: string, extra: Partial<BoardKeyEvent> = {}): BoardKeyEvent => ({
  key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...extra,
});

const field = (tagName: string, text: string, contentEditable = false): BoardKeyTarget => ({ tagName, contentEditable, text });

const column = (key: string, ...convIds: string[]): { key: string; rows: { convId: string }[] } => (
  { key, rows: convIds.map(convId => ({ convId })) }
);

const columns = [
  column('todo', 'a', 'b', 'c'),
  column('empty'),
  column('doing', 'd', 'e'),
  column('done', 'f', 'g', 'h', 'i'),
];

describe('boardArrowOf', () => {
  test('reads the four arrow keys', () => {
    expect(boardArrowOf(press('ArrowLeft'), null)).toBe('ArrowLeft');
    expect(boardArrowOf(press('ArrowRight'), null)).toBe('ArrowRight');
    expect(boardArrowOf(press('ArrowUp'), null)).toBe('ArrowUp');
    expect(boardArrowOf(press('ArrowDown'), null)).toBe('ArrowDown');
  });

  test('ignores other keys, modified arrows and handled events', () => {
    expect(boardArrowOf(press('Enter'), null)).toBeNull();
    expect(boardArrowOf(press('ArrowDown', { shiftKey: true }), null)).toBeNull();
    expect(boardArrowOf(press('ArrowDown', { altKey: true }), null)).toBeNull();
    expect(boardArrowOf(press('ArrowDown', { metaKey: true }), null)).toBeNull();
    expect(boardArrowOf(press('ArrowDown', { ctrlKey: true }), null)).toBeNull();
    expect(boardArrowOf(press('ArrowDown', { defaultPrevented: true }), null)).toBeNull();
  });

  test('leaves the arrows to a field that holds text', () => {
    expect(boardArrowOf(press('ArrowLeft'), field('TEXTAREA', 'hello'))).toBeNull();
    expect(boardArrowOf(press('ArrowUp'), field('INPUT', 'q'))).toBeNull();
    expect(boardArrowOf(press('ArrowRight'), field('DIV', 'note', true))).toBeNull();
  });

  test('takes the arrows from an empty field and from anything that is not a field', () => {
    expect(boardArrowOf(press('ArrowDown'), field('TEXTAREA', ''))).toBe('ArrowDown');
    expect(boardArrowOf(press('ArrowLeft'), field('DIV', '', true))).toBe('ArrowLeft');
    expect(boardArrowOf(press('ArrowRight'), field('DIV', 'Board done 3'))).toBe('ArrowRight');
  });
});

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

describe('revealScrollDelta', () => {
  test('leaves a card that is already in view', () => {
    expect(revealScrollDelta(120, 200, 100, 500)).toBe(0);
    expect(revealScrollDelta(100, 500, 100, 500)).toBe(0);
  });

  test('scrolls up to a card above the view', () => {
    expect(revealScrollDelta(40, 120, 100, 500)).toBe(-60);
  });

  test('scrolls down to a card below the view', () => {
    expect(revealScrollDelta(460, 580, 100, 500)).toBe(80);
  });

  test('keeps the top of a card taller than the view in sight', () => {
    expect(revealScrollDelta(300, 900, 100, 500)).toBe(200);
  });
});
