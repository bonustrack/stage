import { describe, expect, test } from 'bun:test';
import { keccak256 } from 'viem';
import {
  authenticatorIdHashOf, bigintToBytes32, concatBytes, hexOfBigint, p256RawPublicKey, rsToRawSignature, validatorAddressOf,
} from '../src/zerodev/passkeyLink';

describe('passkey link helpers', () => {
  test('strips the validation type prefix to recover the validator address', () => {
    expect(validatorAddressOf('0x017ab16ff354acb328452f1d445b3ddee9a91e9e69')).toBe('0x7ab16ff354acb328452f1d445b3ddee9a91e9e69');
  });

  test('encodes big integers as 32-byte words and builds uncompressed P-256 keys', () => {
    const one = bigintToBytes32(1n);
    expect(one.length).toBe(32);
    expect(one[31]).toBe(1);
    const raw = p256RawPublicKey({ pubX: 1n, pubY: 2n });
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(4);
    expect(raw[32]).toBe(1);
    expect(raw[64]).toBe(2);
  });

  test('joins r and s into a 64-byte signature and concatenates byte arrays', () => {
    const sig = rsToRawSignature(3n, 4n);
    expect(sig.length).toBe(64);
    expect(sig[31]).toBe(3);
    expect(sig[63]).toBe(4);
    expect(Array.from(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3])))).toEqual([1, 2, 3]);
  });

  test('hashes the raw credential id the way the webauthn key does', () => {
    const rawId = new Uint8Array([9, 8, 7]);
    expect(authenticatorIdHashOf(rawId)).toBe(keccak256(rawId));
    expect(hexOfBigint(255n)).toBe('0xff');
  });
});
