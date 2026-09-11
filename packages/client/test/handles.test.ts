import { describe, expect, test } from 'bun:test';
import { conversationPathFor, parseHandle, profilePathFor, profileSlugFor, shareUrlFor, stageLabelOf } from '../src/routing/handles';

const ADDR = '0xEAe6aa1802e2938F510ecDc6Ae18f538be6ED9e1';
const CONV = '748fc31cf68f1dc53d856830fbdd072c748fc31cf68f1dc53d856830fbdd072c';

describe('parseHandle', () => {
  test('recognises addresses, conversation ids, stage labels, basenames and ens names', () => {
    expect(parseHandle(ADDR)).toEqual({ kind: 'address', value: ADDR.toLowerCase() });
    expect(parseHandle(CONV)).toEqual({ kind: 'conversation', value: CONV });
    expect(parseHandle('Boorger')).toEqual({ kind: 'stage', value: 'boorger.stage.base.eth' });
    expect(parseHandle('shrek.base.eth')).toEqual({ kind: 'basename', value: 'shrek.base.eth' });
    expect(parseHandle('fabien.eth')).toEqual({ kind: 'ens', value: 'fabien.eth' });
  });

  test('rejects junk', () => {
    expect(parseHandle('').kind).toBe('invalid');
    expect(parseHandle('-nope').kind).toBe('invalid');
    expect(parseHandle('some.thing.com').kind).toBe('invalid');
    expect(parseHandle('a b').kind).toBe('invalid');
  });
});

describe('paths', () => {
  test('prefer the stage label and fall back to the address', () => {
    expect(stageLabelOf('Boorger.stage.base.eth')).toBe('boorger');
    expect(stageLabelOf('shrek.base.eth')).toBeNull();
    expect(profileSlugFor(ADDR, 'boorger.stage.base.eth')).toBe('boorger');
    expect(profileSlugFor(ADDR, 'shrek.base.eth')).toBe(ADDR.toLowerCase());
    expect(profilePathFor(ADDR, 'boorger.stage.base.eth')).toBe('/profile/boorger');
    expect(conversationPathFor(ADDR, null)).toBe(`/${ADDR.toLowerCase()}`);
    expect(shareUrlFor('/profile/boorger')).toBe('https://stage.box/#/profile/boorger');
  });
});
