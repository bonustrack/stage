import { describe, expect, test } from 'bun:test';
import { contactNameModel, contactsEmptyLabel } from '../src/accounts/contactsScreen';

describe('contactNameModel', () => {
  test('resolved name shows with short address handle', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
    })).toEqual({ name: 'alice.eth', handle: '0x1234…abcd' });
  });

  test('unresolved name falls back with no handle', () => {
    expect(contactNameModel({
      resolvedName: null,
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
    })).toEqual({ name: '0x1234…abcd', handle: undefined });
  });

  test('empty resolved name counts as unresolved', () => {
    expect(contactNameModel({
      resolvedName: '',
      fallbackName: 'fallback',
      shortAddress: 'short',
    })).toEqual({ name: 'fallback', handle: undefined });
  });
});

describe('contactsEmptyLabel', () => {
  test('switches between loading and empty copy', () => {
    expect(contactsEmptyLabel(true)).toBe('Loading contacts…');
    expect(contactsEmptyLabel(false)).toBe('No contacts yet. Start a chat to add one.');
  });
});
