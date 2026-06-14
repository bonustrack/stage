/** Anti-spoof warning logic for the decoded-call card (txDecode.spoofWarning).
 *  Pure + synchronous — exercises the trust-the-decode-not-the-description rules
 *  without any network. */
import { describe, expect, test } from 'bun:test';
import { spoofWarning, type DecodedCall } from '../lib/txDecode';

const verified = (functionName: string): DecodedCall => ({
  decoded: true, verified: true, source: 'sourcify', functionName, signature: `${functionName}()`, args: [],
});

describe('spoofWarning', () => {
  test('plain ETH transfer (no decoded call) -> no warning', () => {
    expect(spoofWarning(null, 'Send 0.1 ETH')).toBeUndefined();
  });

  test('undecodable call -> always warns', () => {
    const c: DecodedCall = { decoded: false, verified: false, source: 'none', args: [], selector: '0xdeadbeef' };
    expect(spoofWarning(c, 'safe')).toMatch(/could not be decoded/i);
  });

  test('4byte-only decode (not on Sourcify) -> NO scary warning, decode shown calmly', () => {
    const c: DecodedCall = { decoded: true, verified: false, source: '4byte', functionName: 'post', signature: 'post(string)', args: [] };
    expect(spoofWarning(c, 'post on Poster')).toBeUndefined();
  });

  test('verified contract, description claims a payment but fn is not a transfer -> warns', () => {
    const w = spoofWarning(verified('post'), 'I am sending you 5 USDC');
    expect(w).toMatch(/post\(\)/);
  });

  test('verified contract, description matches a transfer -> no warning', () => {
    expect(spoofWarning(verified('transfer'), 'send 5 USDC')).toBeUndefined();
  });

  test('verified contract, neutral description -> no warning', () => {
    expect(spoofWarning(verified('post'), 'post a message')).toBeUndefined();
  });
});
