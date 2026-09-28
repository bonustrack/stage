import { describe, expect, test } from 'bun:test';
import { contactNameModel } from '../components/ContactsScreen.model';

describe('contactNameModel', () => {
  test('resolved name shows with short address subtitle', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
    })).toEqual({ name: 'alice.eth', subtitle: '0x1234…abcd' });
  });

  test('unresolved name falls back with no subtitle', () => {
    expect(contactNameModel({
      resolvedName: null,
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
    })).toEqual({ name: '0x1234…abcd', subtitle: undefined });
  });

  test('empty resolved name counts as unresolved', () => {
    expect(contactNameModel({
      resolvedName: '',
      fallbackName: 'fallback',
      shortAddress: 'short',
    })).toEqual({ name: 'fallback', subtitle: undefined });
  });

  test('description replaces the short address subtitle', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
      description: 'Building on Base',
    })).toEqual({ name: 'alice.eth', subtitle: 'Building on Base' });
  });

  test('description shows under an unresolved name', () => {
    expect(contactNameModel({
      resolvedName: null,
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
      description: 'gm',
    })).toEqual({ name: '0x1234…abcd', subtitle: 'gm' });
  });

  test('blank description keeps the short address', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
      description: ' \n\t ',
    })).toEqual({ name: 'alice.eth', subtitle: '0x1234…abcd' });
  });

  test('multi-line description collapses to one line', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: '0x1234…abcd',
      shortAddress: '0x1234…abcd',
      description: '  Builder\n\nat   Stage  ',
    })).toEqual({ name: 'alice.eth', subtitle: 'Builder at Stage' });
  });
});
