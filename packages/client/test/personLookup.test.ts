import { describe, expect, test } from 'bun:test';
import {
  BASE_NAMES_ONLY,
  HANDLE_HELP,
  WITH_MAINNET_ENS,
  lookupAddress,
  lookupFor,
  lookupHint,
  personQuery,
  settleLookup,
  startLookup,
} from '../src/identity/personLookup';

const ALICE = '0xa94Cb9AA3CB82880142ff98706320E1Fb9B31767';
const alice = ALICE.toLowerCase();

describe('personQuery', () => {
  test('a bare username is looked up as a stage name', () => {
    for (const input of ['tony123', '  Tony123  ', '@tony123']) {
      expect(personQuery(input)).toEqual({ kind: 'name', name: 'tony123.stage.base.eth', onMainnet: false });
    }
    expect(personQuery('my-stage-name')).toEqual({ kind: 'name', name: 'my-stage-name.stage.base.eth', onMainnet: false });
  });

  test('a label that cannot be a stage username is not looked up', () => {
    for (const input of ['tony', '', 'tony-', 'x'.repeat(33), 'bob', '0x12', 'not a name']) {
      expect(personQuery(input)).toBeNull();
    }
  });

  test('full names keep their own resolution, mainnet ENS is marked', () => {
    expect(personQuery('vitalik.eth')).toEqual({ kind: 'name', name: 'vitalik.eth', onMainnet: true });
    expect(personQuery('less.base.eth')).toEqual({ kind: 'name', name: 'less.base.eth', onMainnet: false });
    expect(personQuery('alice321.stage.base.eth')).toEqual({ kind: 'name', name: 'alice321.stage.base.eth', onMainnet: false });
  });

  test('an address needs no lookup', () => {
    expect(personQuery(ALICE)).toEqual({ kind: 'address', address: alice });
  });
});

describe('person lookup states', () => {
  test('stage usernames in every spelling resolve through the full onchain name, shown as a handle', () => {
    for (const input of ['alice321', '@alice321', 'alice321.stage.base.eth', '  @Alice321 ']) {
      expect(startLookup(input, BASE_NAMES_ONLY)).toEqual({
        kind: 'resolving',
        input,
        name: 'alice321.stage.base.eth',
        label: '@alice321',
      });
    }
  });

  test('empty and invalid inputs have no address', () => {
    expect(startLookup('  ', BASE_NAMES_ONLY)).toEqual({ kind: 'empty', input: '  ' });
    const invalid = startLookup('bob', BASE_NAMES_ONLY);
    expect(invalid.kind).toBe('invalid');
    expect(lookupAddress(invalid)).toBeNull();
    expect(lookupHint(invalid)).toEqual({ text: HANDLE_HELP, tone: 'secondary' });
  });

  test('a raw address resolves immediately without a label', () => {
    const state = startLookup(ALICE, BASE_NAMES_ONLY);
    expect(state).toEqual({ kind: 'resolved', input: ALICE, address: alice, label: null });
    expect(lookupHint(state)).toBeUndefined();
  });

  test('a username resolves through a spinner state to the address with its handle', () => {
    const resolving = startLookup('@alice321', BASE_NAMES_ONLY);
    expect(resolving.kind).toBe('resolving');
    expect(lookupAddress(resolving)).toBeNull();
    expect(lookupHint(resolving)).toEqual({ text: 'Looking up @alice321…', tone: 'secondary' });
    const resolved = settleLookup(resolving, ALICE);
    expect(resolved).toEqual({ kind: 'resolved', input: '@alice321', address: alice, label: '@alice321' });
    expect(lookupAddress(resolved)).toBe(alice);
  });

  test('an unknown username shows a clear error', () => {
    const unresolved = settleLookup(startLookup('nobody999', BASE_NAMES_ONLY), null);
    expect(unresolved).toEqual({ kind: 'unresolved', input: 'nobody999', label: '@nobody999' });
    expect(lookupHint(unresolved)).toEqual({ text: 'No address found for @nobody999', tone: 'danger' });
  });

  test('basenames resolve on Base, mainnet ENS names are refused without a lookup when the policy says so', () => {
    expect(startLookup('less.base.eth', BASE_NAMES_ONLY).kind).toBe('resolving');
    const ens = startLookup('vitalik.eth', BASE_NAMES_ONLY);
    expect(ens).toEqual({ kind: 'unsupported', input: 'vitalik.eth', label: 'vitalik.eth' });
    expect(lookupAddress(ens)).toBeNull();
    expect(lookupHint(ens)).toEqual({ text: 'vitalik.eth is a mainnet ENS name. Stage only supports names on Base.', tone: 'danger' });
    expect(settleLookup(ens, ALICE)).toBe(ens);
  });

  test('chat search resolves mainnet ENS names', () => {
    expect(startLookup('vitalik.eth', WITH_MAINNET_ENS)).toEqual({
      kind: 'resolving',
      input: 'vitalik.eth',
      name: 'vitalik.eth',
      label: 'vitalik.eth',
    });
  });

  test('settling only applies to a pending lookup', () => {
    const resolved = startLookup(ALICE, BASE_NAMES_ONLY);
    expect(settleLookup(resolved, null)).toBe(resolved);
  });

  test('a stored state for older input never leaks into the current input', () => {
    const stale = settleLookup(startLookup('alice321', BASE_NAMES_ONLY), ALICE);
    expect(lookupFor(stale, 'alice321', BASE_NAMES_ONLY)).toBe(stale);
    const fresh = lookupFor(stale, 'alice3210', BASE_NAMES_ONLY);
    expect(fresh.kind).toBe('resolving');
    expect(lookupAddress(fresh)).toBeNull();
  });
});
