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

  test('clear-signed approve (7730 intent) -> payment-vs-approve warning suppressed', () => {
    // A recognized ERC-7730 approve carries an `intent`. The description says
    // "payment" + the fn is approve (not a transfer) — without the gate this would
    // fire the contradictory red banner above the green success. The intent gate
    // suppresses it.
    const c: DecodedCall = {
      decoded: true, verified: true, source: 'sourcify',
      functionName: 'approve', signature: 'approve(address,uint256)', args: [],
      intent: 'Approve',
    };
    expect(spoofWarning(c, 'I am sending you 5 USDC')).toBeUndefined();
  });

  test('UNrecognized approve (no 7730 intent) + payment description -> still warns', () => {
    // No intent = not on the curated allowlist; the genuine anti-phishing warning
    // must still fire (we only relax for recognized descriptors).
    const c: DecodedCall = {
      decoded: true, verified: true, source: 'sourcify',
      functionName: 'approve', signature: 'approve(address,uint256)', args: [],
    };
    expect(spoofWarning(c, 'I am sending you 5 USDC')).toMatch(/approve\(\)/);
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

// --- ERC-7730 clear-signing enrichment (bundled descriptors, offline) --------
const ERC20_ABI = parseAbi([
  'function transfer(address _to, uint256 _value)',
  'function approve(address _spender, uint256 _value)',
]);
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // mainnet USDC, in bundle
const transferData = encodeFunctionData({
  abi: ERC20_ABI, functionName: 'transfer',
  args: ['0x000000000000000000000000000000000000bEEF', 5_000_000n], // 5 USDC (6 decimals)
});
const approveData = encodeFunctionData({
  abi: ERC20_ABI, functionName: 'approve',
  args: ['0x000000000000000000000000000000000000bEEF', 1_000_000n],
});
const erc20Hit = (url: string) => ({
  ok: true,
  json: async () => (url.includes('sourcify')
    ? { abi: ERC20_ABI, match: 'match' }
    : { results: [] }),
});

describe('decodeCall ERC-7730 enrichment', () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  test('USDC transfer -> Send intent + Amount formatted in USDC + To label', async () => {
    mockFetch(erc20Hit);
    const r = await decodeCall(USDC, transferData, 1);
    expect(r.decoded).toBe(true);
    expect(r.intent).toBe('Send');
    const amount = r.args.find(a => a.label === 'Amount');
    expect(amount?.formatted).toBe('5 USDC');
    const to = r.args.find(a => a.label === 'To');
    expect(to?.formatted).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  test('USDC approve -> Approve intent + Spender/Amount labels', async () => {
    mockFetch(erc20Hit);
    const r = await decodeCall(USDC, approveData, 1);
    expect(r.intent).toBe('Approve');
    expect(r.args.find(a => a.label === 'Spender')).toBeTruthy();
    expect(r.args.find(a => a.label === 'Amount')?.formatted).toBe('1 USDC');
  });

  test('no descriptor (unknown contract) -> no intent/label, raw args intact', async () => {
    mockFetch((url) => (url.includes('sourcify')
      ? { ok: true, json: async () => ({ abi: ERC20_ABI, match: 'match' }) }
      : { ok: true, json: async () => ({ results: [] }) }));
    const r = await decodeCall('0x000000000000000000000000000000000000c0de', transferData, 1);
    expect(r.decoded).toBe(true);
    expect(r.intent).toBeUndefined();
    expect(r.args.every(a => a.label === undefined && a.formatted === undefined)).toBe(true);
  });
});

// --- PROXY tokens: verified ABI lacks the selector, but a curated 7730 descriptor
// pins it (USDC FiatTokenProxy / USDT). Sourcify returns the PROXY's ABI (no
// transfer/approve - those live behind the proxy), so selectorInAbi is false and we
// hit the 'mismatch' branch. The fix: rescue via the bundled descriptor allowlist
// and clear-sign, instead of the red "function does not exist" warning. -----------
// Proxy ABI: a typical FiatTokenProxy surface - no transfer/approve.
const PROXY_ABI = parseAbi([
  'function implementation() view returns (address)',
  'function admin() view returns (address)',
  'function upgradeTo(address newImplementation)',
]);
// Sourcify returns the proxy ABI; 4byte resolves the selector to the canonical sig.
const proxyHit = (sig: string) => (url: string) => ({
  ok: true,
  json: async () => (url.includes('sourcify')
    ? { abi: PROXY_ABI, match: 'match' }
    : { results: [{ id: 1, text_signature: sig }] }),
});

describe('decodeCall PROXY token rescue (verified ABI lacks selector, 7730 descriptor exists)', () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  test('USDC transfer behind a proxy -> clear-signed (Send), NOT a mismatch warning', async () => {
    mockFetch(proxyHit('transfer(address,uint256)'));
    const r = await decodeCall(USDC, transferData, 1);
    expect(r.source).toBe('sourcify'); // rescued, not 'mismatch'
    expect(r.decoded).toBe(true);
    expect(r.intent).toBe('Send');
    expect(r.functionName).toBe('transfer');
    expect(r.args.find(a => a.label === 'Amount')?.formatted).toBe('5 USDC');
    expect(r.args.find(a => a.label === 'To')?.formatted).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(spoofWarning(r, 'send 5 USDC')).toBeUndefined();
  });

  test('USDC approve behind a proxy -> clear-signed (Approve), no warning', async () => {
    mockFetch(proxyHit('approve(address,uint256)'));
    const r = await decodeCall(USDC, approveData, 1);
    expect(r.source).toBe('sourcify');
    expect(r.intent).toBe('Approve');
    expect(r.args.find(a => a.label === 'Spender')).toBeTruthy();
    expect(r.args.find(a => a.label === 'Amount')?.formatted).toBe('1 USDC');
    expect(spoofWarning(r, 'approve')).toBeUndefined();
  });

  test('proxy contract + selector with NO bundled descriptor -> still a mismatch warning (gate intact)', async () => {
    // Unknown contract address (not in the descriptor allowlist) + a generic 4byte hit.
    mockFetch(proxyHit('transfer(address,uint256)'));
    const r = await decodeCall('0x000000000000000000000000000000000000dEAd', transferData, 1);
    expect(r.source).toBe('mismatch');
    expect(r.decoded).toBe(false);
    expect(spoofWarning(r, 'send 5 USDC')).toMatch(/do not sign/i);
  });
});
