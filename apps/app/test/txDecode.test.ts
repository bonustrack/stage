/** Anti-spoof warning logic for the decoded-call card (txDecode.spoofWarning).
 *  Pure + synchronous — exercises the trust-the-decode-not-the-description rules
 *  without any network.
 *
 *  Plus decodeCall (async, network-backed) with a mocked fetch — covers the
 *  selector-not-in-ABI mismatch detection that is the core of this card's safety. */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { encodeFunctionData, parseAbi } from 'viem';
import { decodeCall, spoofWarning, type DecodedCall } from '../lib/txDecode';

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

  test('selector mismatch (verified contract, fn not in ABI) -> prominent do-not-sign warning', () => {
    const c: DecodedCall = {
      decoded: false, verified: true, source: 'mismatch', args: [], selector: '0x8ee93cf3',
      note: 'This calls a function that does not exist on this verified contract (selector 0x8ee93cf3). Looks like post(string) per 4byte, but this contract has no such function. The transaction will likely fail or is malformed - do not sign unless you trust it.',
    };
    const w = spoofWarning(c, 'post a message');
    expect(w).toMatch(/does not exist on this verified contract/i);
    expect(w).toMatch(/do not sign/i);
    expect(w).toMatch(/0x8ee93cf3/);
  });
});

// --- decodeCall: selector-not-in-ABI detection -------------------------------
// Gnosis Guild Poster: deployed contract only has post(string,string). A tx using
// the post(string) selector (0x8ee93cf3) must be flagged as a mismatch, NOT decoded
// calmly via 4byte (which knows post(string) generically) - that tx reverts on-chain.
const POSTER_ABI = parseAbi([
  'function post(string content, string tag)',
]);
const postStringStringData = encodeFunctionData({
  abi: POSTER_ABI, functionName: 'post', args: ['hello', 'metro'],
});
// 0x8ee93cf3 = selector of post(string); valid ABI-encoded calldata for that sig.
const postStringData = encodeFunctionData({
  abi: parseAbi(['function post(string content)']), functionName: 'post', args: ['hello'],
});

type FetchMock = (url: string) => { ok: boolean; json: () => Promise<unknown> };
function mockFetch(impl: FetchMock): void {
  // @ts-expect-error - override global fetch for the test
  globalThis.fetch = async (input: string) => impl(String(input));
}
const realFetch = globalThis.fetch;

const sourcifyHit = (url: string) => ({
  ok: true,
  json: async () => (url.includes('sourcify')
    ? { abi: POSTER_ABI, match: 'match' }
    : { results: [{ id: 1, text_signature: 'post(string)' }] }),
});

describe('decodeCall selector mismatch detection', () => {
  beforeEach(() => { /* fresh module caches via unique addresses per test */ });
  afterEach(() => { globalThis.fetch = realFetch; });

  test('(a) verified contract + valid selector -> decoded sourcify, no warning', async () => {
    mockFetch(sourcifyHit);
    const r = await decodeCall('0x000000000000000000000000000000000000aaa1', postStringStringData, 1);
    expect(r.decoded).toBe(true);
    expect(r.source).toBe('sourcify');
    expect(r.functionName).toBe('post');
    expect(spoofWarning(r, 'post a message')).toBeUndefined();
  });

  test('(b) verified contract + selector NOT in ABI -> mismatch, no fake decode, warning', async () => {
    mockFetch(sourcifyHit);
    const r = await decodeCall('0x000000000000000000000000000000000000aaa2', postStringData, 1);
    expect(r.source).toBe('mismatch');
    expect(r.decoded).toBe(false); // NOT a confident decode
    expect(r.args).toHaveLength(0); // no fabricated args
    expect(r.selector).toBe('0x8ee93cf3');
    const w = spoofWarning(r, 'post a message');
    expect(w).toMatch(/does not exist on this verified contract/i);
    expect(w).toMatch(/do not sign/i);
  });

  test('(c) non-Sourcify contract + 4byte hit -> neutral note, no scary warning', async () => {
    mockFetch((url) => (url.includes('sourcify')
      ? { ok: false, json: async () => ({}) }
      : { ok: true, json: async () => ({ results: [{ id: 1, text_signature: 'post(string)' }] }) }));
    const r = await decodeCall('0x000000000000000000000000000000000000aaa3', postStringData, 1);
    expect(r.source).toBe('4byte');
    expect(r.decoded).toBe(true);
    expect(r.note).toMatch(/function signature/i);
    expect(spoofWarning(r, 'post a message')).toBeUndefined();
  });
});
