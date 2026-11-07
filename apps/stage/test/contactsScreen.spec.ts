import { describe, expect, test } from 'bun:test';
import { contactNameModel } from '../components/contacts/ContactsScreen.model';

const SHORT = '0x1234…abcd';

const model = (fields: Partial<Parameters<typeof contactNameModel>[0]>) =>
  contactNameModel({ resolvedName: null, fallbackName: SHORT, shortAddress: SHORT, ...fields });

describe('contactNameModel', () => {
  test('resolved name shows with short address subtitle', () => {
    expect(model({ resolvedName: 'alice.eth' })).toEqual({ name: 'alice.eth', subtitle: SHORT });
  });

  test('unresolved name still shows the short address', () => {
    expect(model({ resolvedName: null })).toEqual({ name: SHORT, subtitle: SHORT });
  });

  test('empty resolved name counts as unresolved', () => {
    expect(model({ resolvedName: '', fallbackName: 'fallback' })).toEqual({ name: 'fallback', subtitle: SHORT });
  });

  test('description comes first', () => {
    expect(model({ resolvedName: 'Alice', description: 'Building on Base', handle: 'alice123.stage.base.eth' })).toEqual({
      name: 'Alice',
      subtitle: 'Building on Base',
    });
  });

  test('description shows under an unresolved name', () => {
    expect(model({ resolvedName: null, description: 'gm' })).toEqual({ name: SHORT, subtitle: 'gm' });
  });

  test('username comes before the address', () => {
    expect(model({ resolvedName: 'Emma', handle: 'emma123.stage.base.eth' })).toEqual({ name: 'Emma', subtitle: '@emma123' });
  });

  test('a basename username shows as is', () => {
    expect(model({ resolvedName: 'Less', handle: 'less.base.eth' })).toEqual({ name: 'Less', subtitle: 'less.base.eth' });
  });

  test('a username already shown as the name falls back to the address', () => {
    expect(model({ resolvedName: '@tony123', handle: 'tony123.stage.base.eth' })).toEqual({ name: '@tony123', subtitle: SHORT });
  });

  test('blank description and username keep the short address', () => {
    expect(model({ resolvedName: 'alice.eth', description: ' \n\t ', handle: '  ' })).toEqual({ name: 'alice.eth', subtitle: SHORT });
  });

  test('multi-line description collapses to one line', () => {
    expect(model({ resolvedName: 'alice.eth', description: '  Builder\n\nat   Stage  ' })).toEqual({
      name: 'alice.eth',
      subtitle: 'Builder at Stage',
    });
  });
});
