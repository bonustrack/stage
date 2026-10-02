import { describe, expect, test } from 'bun:test';
import {
  deriveOwner, ownerDerivationPath, isValidMnemonic, normalizeMnemonic,
} from '../src/zerodev/derive';
import { nextHdIndex } from '../src/accounts/hdIndex';

const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

const EXPECTED_OWNERS: Record<number, string> = {
  0: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  1: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  2: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
};

describe('zerodev/derive', () => {
  test('ownerDerivationPath follows the BIP-44 account/index scheme', () => {
    expect(ownerDerivationPath(0)).toBe("m/44'/60'/0'/0/0");
    expect(ownerDerivationPath(7)).toBe("m/44'/60'/0'/0/7");
  });

  test('ownerDerivationPath rejects negative or non-integer indices', () => {
    expect(() => ownerDerivationPath(-1)).toThrow();
    expect(() => ownerDerivationPath(1.5)).toThrow();
  });

  test('deriveOwner yields the canonical deterministic owner per hdIndex', () => {
    for (const [index, expected] of Object.entries(EXPECTED_OWNERS)) {
      const owner = deriveOwner(TEST_MNEMONIC, Number(index));
      expect(owner.address.toLowerCase()).toBe(expected);
    }
  });

  test('distinct hdIndex values derive distinct owners', () => {
    const addrs = new Set([0, 1, 2].map((i) => deriveOwner(TEST_MNEMONIC, i).address.toLowerCase()));
    expect(addrs.size).toBe(3);
  });

  test('mnemonic normalization is case- and whitespace-insensitive', () => {
    const messy = '  TEST   test test test test test test test test test test JUNK  ';
    expect(normalizeMnemonic(messy)).toBe(TEST_MNEMONIC);
    expect(deriveOwner(messy, 0).address.toLowerCase()).toBe(EXPECTED_OWNERS[0]);
  });

  test('isValidMnemonic gates on BIP-39 checksum + word count', () => {
    expect(isValidMnemonic(TEST_MNEMONIC)).toBe(true);
    expect(isValidMnemonic('not a real seed phrase at all nope nope nope')).toBe(false);
    expect(() => deriveOwner('garbage phrase', 0)).toThrow();
  });
});

describe('nextHdIndex', () => {
  test('never reuses an index below the high-water mark, even after deletions', () => {
    expect(nextHdIndex([0], null)).toBe(1);
    expect(nextHdIndex([0], 2)).toBe(2);
    expect(nextHdIndex([], 3)).toBe(3);
  });

  test('starts at zero on a fresh device and skips gaps in the live list', () => {
    expect(nextHdIndex([], null)).toBe(0);
    expect(nextHdIndex([0, 2], null)).toBe(3);
  });
});
