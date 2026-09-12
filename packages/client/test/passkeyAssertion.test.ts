import { describe, expect, test } from 'bun:test';
import { p256 } from '@noble/curves/p256';
import { sha256 } from 'viem';
import { concatBytes, passkeyAssertionMatches, type PasskeyPublicKey } from '../src/zerodev/passkeyLink';

function keyOf(privateKey: Uint8Array): PasskeyPublicKey {
  const point = p256.ProjectivePoint.fromPrivateKey(privateKey);
  return { pubX: point.x, pubY: point.y };
}

describe('passkeyAssertionMatches', () => {
  const privateKey = p256.utils.randomPrivateKey();
  const authenticatorData = new Uint8Array(37).fill(7);
  const clientDataJSON = new TextEncoder().encode('{"type":"webauthn.get","challenge":"abc"}');
  const signed = sha256(concatBytes(authenticatorData, sha256(clientDataJSON, 'bytes')), 'bytes');
  const sig = p256.sign(signed, privateKey, { prehash: false });

  test('accepts an assertion signed by the account passkey', () => {
    expect(passkeyAssertionMatches(keyOf(privateKey), authenticatorData, clientDataJSON, sig.r, sig.s)).toBe(true);
  });

  test('rejects another passkey and tampered data', () => {
    expect(passkeyAssertionMatches(keyOf(p256.utils.randomPrivateKey()), authenticatorData, clientDataJSON, sig.r, sig.s)).toBe(false);
    expect(passkeyAssertionMatches(keyOf(privateKey), authenticatorData, new TextEncoder().encode('{}'), sig.r, sig.s)).toBe(false);
  });
});
