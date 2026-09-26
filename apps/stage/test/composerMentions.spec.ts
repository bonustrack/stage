import { describe, expect, test } from 'bun:test';
import {
  applyDisplayEdit, editRegion, insertMention, mentionKeyAction, mentionQuery, piecesOf, toDisplay,
} from '../components/composer/mentions.model';

const ALICE = `0x${'a'.repeat(40)}`;
const BOB = `0x${'b'.repeat(40)}`;
const NAMES: Record<string, string> = { [ALICE]: '@alice', [BOB]: '@bob' };
const labelOf = (address: string): string => NAMES[address] ?? '@someone';
const shortOf = (address: string): string => `@${address.slice(0, 6)}`;
const BANG: Record<string, string> = { [BOB]: '@bob!' };
const bangOf = (address: string): string => BANG[address] ?? labelOf(address);
const people = [{ address: ALICE, name: 'alice' }, { address: BOB, name: 'bob' }];

function edit(wire: string, next: string, at: number, end = at): ReturnType<typeof applyDisplayEdit> {
  return applyDisplayEdit(piecesOf(wire, labelOf), next, labelOf, { start: at, end });
}

describe('composer mention display', () => {
  test('shows every mention as its label', () => {
    expect(toDisplay(`hi @${ALICE} and @${BOB} `, labelOf)).toBe('hi @alice and @bob ');
  });

  test('keeps the address when typing after the mention', () => {
    expect(edit(`@${ALICE} `, '@alice x', 7).wire).toBe(`@${ALICE} x`);
  });

  test('keeps the address when typing before the mention', () => {
    expect(edit(`hi @${ALICE} `, 'hi, @alice ', 2).wire).toBe(`hi, @${ALICE} `);
  });

  test('keeps the address when punctuation follows the label', () => {
    expect(edit(`@${ALICE}`, '@alice,', 6).wire).toBe(`@${ALICE},`);
  });

  test('turns the mention into its text when typing inside the label', () => {
    expect(edit(`@${ALICE} `, '@alxice ', 3).wire).toBe('@alxice ');
  });

  test('turns the mention into its text when erasing its last letter', () => {
    const r = edit(`@${ALICE}`, '@alic', 6);
    expect(r.wire).toBe('@alic');
    expect(r.caret).toBe(5);
  });

  test('turns the mention into its text when a letter is glued to it', () => {
    expect(edit(`@${ALICE} hello`, '@alicehello', 7).wire).toBe('@alicehello');
    expect(edit(`@${ALICE}`, '@alicex', 6).wire).toBe('@alicex');
    expect(edit(`@${ALICE}`, '@alice1', 6).wire).toBe('@alice1');
  });

  test('drops a mention removed by a selection', () => {
    expect(edit(`hi @${ALICE} there`, 'hi X there', 3, 9).wire).toBe('hi X there');
  });

  test('shows a pasted address as its label with the caret after it', () => {
    const r = edit('say ', `say @${BOB}`, 4);
    expect(r.wire).toBe(`say @${BOB}`);
    expect(r.display).toBe('say @bob');
    expect(r.caret).toBe(8);
  });

  test('keeps the caret after a label pasted between words', () => {
    const r = edit('say  ok', `say @${BOB} ok`, 4);
    expect(r.display).toBe('say @bob ok');
    expect(r.caret).toBe(8);
  });

  test('finds the edit when the caret hint is stale', () => {
    expect(editRegion('hello world', 'hello, world', { start: 0, end: 0 })).toEqual({ start: 5, end: 5 });
    expect(edit(`@${ALICE} hi`, '@alice hi!', 0).wire).toBe(`@${ALICE} hi!`);
  });

  test('reads backspace and forward delete from the caret', () => {
    expect(editRegion('aab', 'ab', { start: 2, end: 2 })).toEqual({ start: 1, end: 2 });
    expect(editRegion('aab', 'ab', { start: 0, end: 0 })).toEqual({ start: 0, end: 1 });
    expect(editRegion('abb', 'ab', { start: 2, end: 2 })).toEqual({ start: 1, end: 2 });
  });

  test('reads a delete that could be either key as the one that keeps the mention', () => {
    const shown = piecesOf(`@${BOB}!!`, bangOf);
    expect(applyDisplayEdit(shown, '@bob!!', bangOf, { start: 5, end: 5 }).wire).toBe(`@${BOB}!`);
    expect(applyDisplayEdit(shown, '@bob!!', bangOf, { start: 7, end: 7 }).wire).toBe(`@${BOB}!`);
  });

  test('keeps the mention when editing right at its edges', () => {
    expect(edit(`@${ALICE}`, '(@alice', 0).wire).toBe(`(@${ALICE}`);
    expect(edit(`hi @${ALICE}`, 'hi@alice', 3).wire).toBe(`hi@${ALICE}`);
    expect(edit(`@${ALICE}, hi`, '@alice hi', 7).wire).toBe(`@${ALICE} hi`);
  });

  test('finds the edit when the caret hint is past it', () => {
    expect(edit(`@${ALICE} hi`, 'X@alice hi', 9).wire).toBe(`X@${ALICE} hi`);
  });

  test('edits against the labels that were on screen when a name loads', () => {
    const r = applyDisplayEdit(piecesOf(`hey @${ALICE} `, shortOf), 'hey @0xaaaa x', labelOf, { start: 12, end: 12 });
    expect(r.wire).toBe(`hey @${ALICE} x`);
    expect(r.display).toBe('hey @alice x');
    expect(r.caret).toBe(12);
  });

  test('keeps the caret in place when a later label changes length', () => {
    const r = applyDisplayEdit(piecesOf(`hi @${BOB}`, shortOf), 'hi, @0xbbbb', labelOf, { start: 2, end: 2 });
    expect(r.wire).toBe(`hi, @${BOB}`);
    expect(r.caret).toBe(3);
  });
});

describe('composer mention insert', () => {
  test('sends the address and puts the caret after the label', () => {
    const r = insertMention(piecesOf('hey @al', labelOf), { start: 4, end: 7 }, ALICE.toUpperCase().replace('0X', '0x'), labelOf);
    expect(r.wire).toBe(`hey @${ALICE} `);
    expect(r.caret).toBe('hey @alice '.length);
  });

  test('maps the query past earlier mentions', () => {
    const wire = `@${BOB} and @al`;
    const r = insertMention(piecesOf(wire, labelOf), { start: 9, end: 12 }, ALICE, labelOf);
    expect(r.wire).toBe(`@${BOB} and @${ALICE} `);
    expect(toDisplay(r.wire, labelOf)).toBe('@bob and @alice ');
    expect(r.caret).toBe('@bob and @alice '.length);
  });

  test('keeps the text after the query', () => {
    const r = insertMention(piecesOf('@b see', labelOf), { start: 0, end: 2 }, BOB, labelOf);
    expect(r.wire).toBe(`@${BOB}  see`);
    expect(r.caret).toBe(5);
  });

  test('places the query by the labels that were on screen', () => {
    const r = insertMention(piecesOf(`@${BOB} and @al`, shortOf), { start: 12, end: 15 }, ALICE, labelOf);
    expect(r.wire).toBe(`@${BOB} and @${ALICE} `);
    expect(r.caret).toBe('@bob and @alice '.length);
  });
});

describe('composer mention query', () => {
  test('suggests people for a new @', () => {
    const pieces = piecesOf(`@${BOB} @al`, labelOf);
    const q = mentionQuery(pieces, 8, people);
    expect(q.range).toEqual({ start: 5, end: 8 });
    expect(q.matches.map(c => c.name)).toEqual(['alice']);
  });

  test('stays closed on a label that is already a mention', () => {
    const pieces = piecesOf(`@${ALICE}`, labelOf);
    expect(mentionQuery(pieces, 6, people)).toEqual({ matches: [], range: null });
  });
});

describe('composer mention keys', () => {
  test('moves through the list and wraps', () => {
    expect(mentionKeyAction('ArrowDown', false, 3, 2)).toEqual({ kind: 'move', index: 0 });
    expect(mentionKeyAction('ArrowUp', false, 3, 0)).toEqual({ kind: 'move', index: 2 });
  });

  test('picks with Enter or Tab and dismisses with Escape', () => {
    expect(mentionKeyAction('Enter', false, 2, 0)).toEqual({ kind: 'pick' });
    expect(mentionKeyAction('Tab', false, 2, 0)).toEqual({ kind: 'pick' });
    expect(mentionKeyAction('Escape', false, 2, 0)).toEqual({ kind: 'dismiss' });
  });

  test('leaves other keys and an empty list alone', () => {
    expect(mentionKeyAction('Enter', true, 2, 0)).toBeNull();
    expect(mentionKeyAction('a', false, 2, 0)).toBeNull();
    expect(mentionKeyAction('ArrowDown', false, 0, 0)).toBeNull();
  });
});
