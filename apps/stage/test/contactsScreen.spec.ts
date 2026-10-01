import { describe, expect, test } from 'bun:test';
import { contactNameModel } from '../components/ContactsScreen.model';

const SHORT = '0x1234…abcd';

describe('contactNameModel', () => {
  test('resolved name shows with short address subtitle', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: SHORT,
      shortAddress: SHORT,
    })).toEqual({ name: 'alice.eth', subtitle: SHORT });
  });

  test('unresolved name still shows the short address', () => {
    expect(contactNameModel({
      resolvedName: null,
      fallbackName: SHORT,
      shortAddress: SHORT,
    })).toEqual({ name: SHORT, subtitle: SHORT });
  });

  test('empty resolved name counts as unresolved', () => {
    expect(contactNameModel({
      resolvedName: '',
      fallbackName: 'fallback',
      shortAddress: SHORT,
    })).toEqual({ name: 'fallback', subtitle: SHORT });
  });

  test('description comes first', () => {
    expect(contactNameModel({
      resolvedName: 'Alice',
      fallbackName: SHORT,
      shortAddress: SHORT,
      description: 'Building on Base',
      handle: 'alice123.stage.base.eth',
    })).toEqual({ name: 'Alice', subtitle: 'Building on Base' });
  });

  test('description shows under an unresolved name', () => {
    expect(contactNameModel({
      resolvedName: null,
      fallbackName: SHORT,
      shortAddress: SHORT,
      description: 'gm',
    })).toEqual({ name: SHORT, subtitle: 'gm' });
  });

  test('username comes before the address', () => {
    expect(contactNameModel({
      resolvedName: 'Emma',
      fallbackName: SHORT,
      shortAddress: SHORT,
      handle: 'emma123.stage.base.eth',
    })).toEqual({ name: 'Emma', subtitle: '@emma123' });
  });

  test('a basename username shows as is', () => {
    expect(contactNameModel({
      resolvedName: 'Less',
      fallbackName: SHORT,
      shortAddress: SHORT,
      handle: 'less.base.eth',
    })).toEqual({ name: 'Less', subtitle: 'less.base.eth' });
  });

  test('a username already shown as the name falls back to the address', () => {
    expect(contactNameModel({
      resolvedName: '@tony123',
      fallbackName: SHORT,
      shortAddress: SHORT,
      handle: 'tony123.stage.base.eth',
    })).toEqual({ name: '@tony123', subtitle: SHORT });
  });

  test('blank description and username keep the short address', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: SHORT,
      shortAddress: SHORT,
      description: ' \n\t ',
      handle: '  ',
    })).toEqual({ name: 'alice.eth', subtitle: SHORT });
  });

  test('multi-line description collapses to one line', () => {
    expect(contactNameModel({
      resolvedName: 'alice.eth',
      fallbackName: SHORT,
      shortAddress: SHORT,
      description: '  Builder\n\nat   Stage  ',
    })).toEqual({ name: 'alice.eth', subtitle: 'Builder at Stage' });
  });
});
