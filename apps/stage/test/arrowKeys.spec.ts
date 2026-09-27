import { describe, expect, test } from 'bun:test';
import {
  ALL_ARROWS, VERTICAL_ARROWS, arrowKeyOf, revealScrollDelta, stepRow, type ArrowKeyEvent, type ArrowKeyTarget,
} from '../components/arrowKeys.model';

const press = (key: string, extra: Partial<ArrowKeyEvent> = {}): ArrowKeyEvent => ({
  key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...extra,
});

const field = (tagName: string, text: string, contentEditable = false): ArrowKeyTarget => ({ tagName, contentEditable, text });

const rows = ['a', 'b', 'c'].map(convId => ({ convId }));

describe('arrowKeyOf', () => {
  test('reads the four arrow keys', () => {
    expect(arrowKeyOf(press('ArrowLeft'), null, ALL_ARROWS)).toBe('ArrowLeft');
    expect(arrowKeyOf(press('ArrowRight'), null, ALL_ARROWS)).toBe('ArrowRight');
    expect(arrowKeyOf(press('ArrowUp'), null, ALL_ARROWS)).toBe('ArrowUp');
    expect(arrowKeyOf(press('ArrowDown'), null, ALL_ARROWS)).toBe('ArrowDown');
  });

  test('reads only the arrows it is given', () => {
    expect(arrowKeyOf(press('ArrowUp'), null, VERTICAL_ARROWS)).toBe('ArrowUp');
    expect(arrowKeyOf(press('ArrowDown'), null, VERTICAL_ARROWS)).toBe('ArrowDown');
    expect(arrowKeyOf(press('ArrowLeft'), null, VERTICAL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowRight'), null, VERTICAL_ARROWS)).toBeNull();
  });

  test('ignores other keys, modified arrows and handled events', () => {
    expect(arrowKeyOf(press('Enter'), null, ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowDown', { shiftKey: true }), null, ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowDown', { altKey: true }), null, ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowDown', { metaKey: true }), null, ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowDown', { ctrlKey: true }), null, ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowDown', { defaultPrevented: true }), null, ALL_ARROWS)).toBeNull();
  });

  test('leaves the arrows to a field that holds text', () => {
    expect(arrowKeyOf(press('ArrowLeft'), field('TEXTAREA', 'hello'), ALL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowUp'), field('INPUT', 'q'), VERTICAL_ARROWS)).toBeNull();
    expect(arrowKeyOf(press('ArrowRight'), field('DIV', 'note', true), ALL_ARROWS)).toBeNull();
  });

  test('takes the arrows from an empty field and from anything that is not a field', () => {
    expect(arrowKeyOf(press('ArrowDown'), field('TEXTAREA', ''), VERTICAL_ARROWS)).toBe('ArrowDown');
    expect(arrowKeyOf(press('ArrowLeft'), field('DIV', '', true), ALL_ARROWS)).toBe('ArrowLeft');
    expect(arrowKeyOf(press('ArrowRight'), field('DIV', 'Board done 3'), ALL_ARROWS)).toBe('ArrowRight');
  });
});

describe('stepRow', () => {
  test('moves to the row above or below', () => {
    expect(stepRow(rows, 'b', 'ArrowUp')).toEqual({ convId: 'a' });
    expect(stepRow(rows, 'b', 'ArrowDown')).toEqual({ convId: 'c' });
  });

  test('stops at the first and last rows', () => {
    expect(stepRow(rows, 'a', 'ArrowUp')).toBeNull();
    expect(stepRow(rows, 'c', 'ArrowDown')).toBeNull();
  });

  test('does nothing without an open row in the list', () => {
    expect(stepRow(rows, null, 'ArrowDown')).toBeNull();
    expect(stepRow(rows, 'gone', 'ArrowUp')).toBeNull();
    expect(stepRow([], 'a', 'ArrowDown')).toBeNull();
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
