import { afterEach, describe, expect, test } from 'bun:test';
import { encodeFunctionData, parseAbi } from 'viem';
import { decodeCall, spoofWarning, type DecodedCall } from '../src/wallet/txDecode';

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

const POSTER_ABI = parseAbi([
  'function post(string content, string tag)',
]);
const postStringStringData = encodeFunctionData({
  abi: POSTER_ABI, functionName: 'post', args: ['hello', 'metro'],
});
const postStringData = encodeFunctionData({
  abi: parseAbi(['function post(string content)']), functionName: 'post', args: ['hello'],
});

type FetchMock = (url: string) => { ok: boolean; json: () => Promise<unknown> };
function mockFetch(impl: FetchMock): void {
  const mocked: typeof globalThis.fetch = (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(impl(url) as unknown as Response);
  };
  globalThis.fetch = mocked;
}
const realFetch = globalThis.fetch;

const sourcifyHit = (url: string) => ({
  ok: true,
  json: () => Promise.resolve(url.includes('sourcify')
    ? { abi: POSTER_ABI, match: 'match' }
    : { results: [{ id: 1, text_signature: 'post(string)' }] }),
});

describe('decodeCall selector mismatch detection', () => {
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
    expect(r.decoded).toBe(false);
    expect(r.args).toHaveLength(0);
    expect(r.selector).toBe('0x8ee93cf3');
    const w = spoofWarning(r, 'post a message');
    expect(w).toMatch(/does not exist on this verified contract/i);
    expect(w).toMatch(/do not sign/i);
  });

  test('(c) non-Sourcify contract + 4byte hit -> neutral note, no scary warning', async () => {
    mockFetch((url) => (url.includes('sourcify')
      ? { ok: false, json: () => Promise.resolve({}) }
      : { ok: true, json: () => Promise.resolve({ results: [{ id: 1, text_signature: 'post(string)' }] }) }));
    const r = await decodeCall('0x000000000000000000000000000000000000aaa3', postStringData, 1);
    expect(r.source).toBe('4byte');
    expect(r.decoded).toBe(true);
    expect(r.note).toMatch(/function signature/i);
    expect(spoofWarning(r, 'post a message')).toBeUndefined();
  });
});
