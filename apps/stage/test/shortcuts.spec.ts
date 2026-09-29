import { describe, expect, test } from 'bun:test';
import { shortcutKey, shortcutOf, type ShortcutKeyEvent, type ShortcutTarget } from '../components/shortcuts.model';

const press = (key: string, extra: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  key, altKey: false, ctrlKey: false, metaKey: false, defaultPrevented: false, isComposing: false, ...extra,
});

const on = (tagName: string, contentEditable = false): ShortcutTarget => ({ tagName, contentEditable });

describe('shortcutOf', () => {
  test('reads slash and c in both cases', () => {
    expect(shortcutOf(press('/'), null, false)).toBe('/');
    expect(shortcutOf(press('c'), null, false)).toBe('c');
    expect(shortcutOf(press('C'), null, false)).toBe('c');
    expect(shortcutOf(press('/'), on('BODY'), false)).toBe('/');
    expect(shortcutOf(press('c'), on('DIV'), false)).toBe('c');
  });

  test('ignores other keys', () => {
    expect(shortcutOf(press('x'), null, false)).toBeNull();
    expect(shortcutOf(press('?'), null, false)).toBeNull();
    expect(shortcutOf(press('Enter'), null, false)).toBeNull();
    expect(shortcutOf(press('constructor'), null, false)).toBeNull();
  });

  test('ignores ctrl, alt and meta but keeps shift for layouts that need it', () => {
    expect(shortcutOf(press('c', { ctrlKey: true }), null, false)).toBeNull();
    expect(shortcutOf(press('c', { metaKey: true }), null, false)).toBeNull();
    expect(shortcutOf(press('c', { altKey: true }), null, false)).toBeNull();
    expect(shortcutOf(press('/', { ctrlKey: true }), null, false)).toBeNull();
    expect(shortcutOf(press('/', { metaKey: true }), null, false)).toBeNull();
    expect(shortcutOf(press('/', { altKey: true }), null, false)).toBeNull();
  });

  test('leaves the key to inputs, text areas and editable content', () => {
    expect(shortcutOf(press('/'), on('INPUT'), false)).toBeNull();
    expect(shortcutOf(press('c'), on('TEXTAREA'), false)).toBeNull();
    expect(shortcutOf(press('c'), on('SELECT'), false)).toBeNull();
    expect(shortcutOf(press('/'), on('DIV', true), false)).toBeNull();
  });

  test('ignores IME composition, handled events and open dialogs', () => {
    expect(shortcutOf(press('c', { isComposing: true }), null, false)).toBeNull();
    expect(shortcutOf(press('/', { defaultPrevented: true }), null, false)).toBeNull();
    expect(shortcutOf(press('/'), null, true)).toBeNull();
    expect(shortcutOf(press('c'), null, true)).toBeNull();
  });
});

describe('shortcutKey', () => {
  test('shows the key as printed on the keyboard', () => {
    expect(shortcutKey('/')).toBe('/');
    expect(shortcutKey('c')).toBe('C');
  });
});
