import { describe, expect, test } from 'bun:test';
import { conversationPathFor, isPeerHandleSegment, parseHandle, profileSlugFor } from '../src/routing/handles';
import { APP_ROUTE_SEGMENTS } from '../src/routing/routes';
import { shareUrlFor } from '../src/routing/stageLinks';
import { stageLabelOf } from '../src/identity/stageNames';

const ADDR = '0xEAe6aa1802e2938F510ecDc6Ae18f538be6ED9e1';
const CONV = '748fc31cf68f1dc53d856830fbdd072c748fc31cf68f1dc53d856830fbdd072c';

describe('parseHandle', () => {
  test('recognises addresses, conversation ids, stage labels, basenames and ens names', () => {
    expect(parseHandle(ADDR)).toEqual({ kind: 'address', value: ADDR.toLowerCase() });
    expect(parseHandle(CONV)).toEqual({ kind: 'conversation', value: CONV });
    expect(parseHandle('748fc31cf68f1dc53d856830fbdd072c').kind).toBe('conversation');
    expect(parseHandle('Boorger')).toEqual({ kind: 'stage', value: 'boorger.stage.base.eth' });
    expect(parseHandle('shrek.base.eth')).toEqual({ kind: 'basename', value: 'shrek.base.eth' });
    expect(parseHandle('Boorger.stage.base.eth')).toEqual({ kind: 'stage', value: 'boorger.stage.base.eth' });
    expect(parseHandle('fabien.eth')).toEqual({ kind: 'ens', value: 'fabien.eth' });
  });

  test('rejects junk', () => {
    expect(parseHandle('').kind).toBe('invalid');
    expect(parseHandle('-nope').kind).toBe('invalid');
    expect(parseHandle('some.thing.com').kind).toBe('invalid');
    expect(parseHandle('a b').kind).toBe('invalid');
  });
});

describe('isPeerHandleSegment', () => {
  test('accepts peer handles but never app routes', () => {
    expect(isPeerHandleSegment('boorger')).toBe(true);
    expect(isPeerHandleSegment('fabien.eth')).toBe(true);
    expect(isPeerHandleSegment(ADDR)).toBe(true);
    for (const segment of APP_ROUTE_SEGMENTS) expect(isPeerHandleSegment(segment)).toBe(false);
    for (const segment of ['channels', 'xmtp', 'requests', 'new-group', 'accounts', 'group', 'user', 'embed']) {
      expect(isPeerHandleSegment(segment)).toBe(false);
    }
    expect(isPeerHandleSegment('Signup')).toBe(false);
    expect(isPeerHandleSegment(CONV)).toBe(false);
    expect(isPeerHandleSegment('')).toBe(false);
  });
});

describe('paths', () => {
  test('reserved page names use addresses for chat links but keep their profile slugs', () => {
    for (const label of ['contacts', 'dashboard', 'storage', 'inbox', 'signup', 'import', 'account']) {
      const handle = `${label}.stage.base.eth`;
      expect(conversationPathFor(ADDR, handle)).toBe(`/${ADDR.toLowerCase()}`);
      expect(profileSlugFor(ADDR, handle)).toBe(label);
    }
    expect(conversationPathFor(ADDR, 'boorger.stage.base.eth')).toBe('/boorger');
  });

  test('prefer the stage label and fall back to the address', () => {
    expect(stageLabelOf('Boorger.stage.base.eth')).toBe('boorger');
    expect(stageLabelOf('shrek.base.eth')).toBeNull();
    expect(profileSlugFor(ADDR, 'boorger.stage.base.eth')).toBe('boorger');
    expect(profileSlugFor(ADDR, 'shrek.base.eth')).toBe(ADDR.toLowerCase());
    expect(conversationPathFor(ADDR, null)).toBe(`/${ADDR.toLowerCase()}`);
    expect(shareUrlFor('/profile/boorger')).toBe('https://stage.box/#/profile/boorger');
  });
});
