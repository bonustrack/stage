/** Stage username spec: rules + claim-message determinism + parity with the
 *  daemon-side copy (packages/metro/src/stations/usernames/username-spec.ts).
 *  If these two ever drift, signatures verified on one side fail on the other,
 *  so the parity assertions below are load-bearing. */

import { describe, expect, test } from 'bun:test';
import {
  validateName, normalizeName, claimMessage, fullName, RESERVED,
} from '../src/identity/username';
import * as daemon from '../../metro/src/stations/usernames/username-spec';

describe('validateName', () => {
  test('accepts valid labels', () => {
    expect(validateName('alice')).toBeNull();
    expect(validateName('a-b-c')).toBeNull();
    expect(validateName('abc123')).toBeNull();
  });
  test('rejects bad length / charset / reserved', () => {
    expect(validateName('ab')).toBe('length');
    expect(validateName('a'.repeat(33))).toBe('length');
    expect(validateName('-abc')).toBe('charset');
    expect(validateName('ab--c')).toBe('charset');
    expect(validateName('Alice')).toBe('charset');
    expect(validateName('admin')).toBe('reserved');
  });
});

describe('normalizeName', () => {
  test('lowercases, trims, strips suffixes', () => {
    expect(normalizeName('  Alice ')).toBe('alice');
    expect(normalizeName('bob.stage.eth')).toBe('bob');
    expect(normalizeName('carol.eth')).toBe('carol');
  });
});

describe('claimMessage', () => {
  test('is deterministic + canonical (lowercased address, full name)', () => {
    const m = claimMessage('alice', '0xABCdef0000000000000000000000000000000001', 123);
    expect(m).toBe(
      'Stage username claim\nname: alice.stage.eth\naddress: 0xabcdef0000000000000000000000000000000001\nts: 123',
    );
    expect(fullName('alice')).toBe('alice.stage.eth');
  });
});

describe('SDK ↔ daemon-copy parity', () => {
  test('claimMessage identical', () => {
    expect(daemon.claimMessage('alice', '0xAbc', 9)).toBe(claimMessage('alice', '0xAbc', 9));
  });
  test('validation identical across samples', () => {
    for (const n of ['alice', 'ab', 'a-b', '-x', 'Admin', 'admin', 'a'.repeat(40), 'ok-name-1']) {
      expect(daemon.validateName(daemon.normalizeName(n)))
        .toBe(validateName(normalizeName(n)));
    }
  });
  test('reserved sets identical', () => {
    expect([...daemon.RESERVED].sort()).toEqual([...RESERVED].sort());
  });
});
