/** Async calldata decoder for the tx-request card — turns a raw `call.data`
 *  into a human "function + decoded args" view so the user trusts what the tx
 *  ACTUALLY does, not the sender's self-described `metadata.description`.
 *
 *  Why a separate module from txConfirm.ts: txConfirm is pure + synchronous (no
 *  network) so the security confirm-summary stays unit-testable and can never be
 *  blocked by a slow/failed fetch. This module is the network layer — it resolves
 *  the contract ABI and decodes the call — and is consumed by the card UI via a
 *  hook. It NEVER blocks signing: on any failure it returns a `decoded:false`
 *  result carrying the raw selector + a "could not decode" note.
 *
 *  ABI resolution order:
 *   1. SOURCIFY — the contract's verified metadata.json (full or partial match)
 *      for `to` on the tx chain. Gives the full ABI -> exact functionName + named
 *      args via viem decodeFunctionData. `verified` reflects full-match.
 *   2. 4BYTE DIRECTORY — when Sourcify has no ABI, resolve the 4-byte selector to
 *      a function signature and decode the args against it (no arg names, just
 *      types). The contract is `verified:false` (unknown source).
 *   3. Neither -> raw selector + "unknown function (unverified contract)".
 *
 *  Results are cached per (chainId+address) for ABIs and per selector for 4byte,
 *  so a conversation full of requests to the same contract fetches once. */

import { useEffect, useState } from 'react';
import {
  decodeFunctionData, parseAbiItem, toFunctionSelector, type Abi, type Hex,
} from 'viem';

/** One decoded argument: a name (from the ABI, or `arg0` when unnamed via 4byte)
 *  and a display-ready string value. */
export interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface DecodedCall {
  /** True when we resolved a function name + decoded the args (Sourcify or 4byte). */
  decoded: boolean;
  /** True when the contract's SOURCE is verified on Sourcify (full OR partial
   *  match) — the ABI is authentic. Drives whether we show a calm decode vs any
   *  caution. False for a 4byte-only / undecodable resolve. */
  verified: boolean;
  /** How we resolved the ABI:
   *   - 'sourcify' : authentic ABI from the verified source (calm, no caution)
   *   - '4byte'    : function signature only, from the 4byte directory (calm
   *                  decode + a subtle "decoded via function signature" note)
   *   - 'none'     : nothing matched (genuinely undecodable — a real warning) */
  source: 'sourcify' | '4byte' | 'none';
  /** Resolved function name (e.g. "post"), or undefined when nothing matched. */
  functionName?: string;
  /** Full signature when known (e.g. "post(string)"). */
  signature?: string;
  /** Decoded arguments in order. Empty for a no-arg call or when undecodable. */
  args: DecodedArg[];
  /** The 4-byte selector (0x + 8 hex), always present for a call with data. */
  selector?: string;
  /** Human note when we could not fully decode (shown on the card). */
  note?: string;
}

/** Sourcify v2 contract API: returns the ABI + match status ('match' / 'exact_match'
 *  for full, 'match' for partial) in ONE call with no redirect. The legacy
 *  repo.sourcify.dev/contracts host 307-redirects to a deprecated path, which made
 *  RN fetch unreliable and falsely dropped verified contracts to the 4byte path. */
const SOURCIFY_BASE = 'https://sourcify.dev/server/v2/contract';
const FOURBYTE_BASE = 'https://www.4byte.directory/api/v1/signatures/';

/** Per (chainId:address) -> resolved ABI (or null when the contract is not
 *  verified on Sourcify). In-memory; lives for the app session. */
const abiCache = new Map<string, { abi: Abi; verified: boolean } | null>();
/** Per selector -> text signature from 4byte (or null when unknown). */
const sigCache = new Map<string, string | null>();

function selectorOf(data?: string): string | undefined {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return undefined;
  return data.slice(0, 10).toLowerCase();
}

/** Stringify a decoded arg value for display (BigInt-safe, address-preserving). */
function fmtArg(v: unknown): string {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.map(fmtArg).join(', ')}]`;
  if (v && typeof v === 'object') {
    try { return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)); }
    catch { return String(v); }
  }
  return String(v);
}

/** Fetch the verified ABI for `address` on `chainId` from the Sourcify v2 API.
 *  A `match` of any kind (full OR partial) means the contract's SOURCE is verified
 *  and the returned ABI is authentic (partial = same bytecode, metadata hash differs
 *  only by e.g. a compiler path), so both count as verified. Returns null when the
 *  contract isn't on Sourcify or the fetch fails. Cached. */
async function fetchSourcifyAbi(
  chainId: number, address: string,
): Promise<{ abi: Abi; verified: boolean } | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = abiCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const url = `${SOURCIFY_BASE}/${chainId}/${address}?fields=abi`;
    const res = await fetch(url);
    if (res.ok) {
      const meta = (await res.json()) as {
        abi?: Abi; match?: string | null;
      };
      const abi = meta?.abi;
      // `match` is 'exact_match' | 'match' (full/partial) when verified, null otherwise.
      if (Array.isArray(abi) && abi.length && meta.match) {
        const out = { abi, verified: true };
        abiCache.set(key, out);
        return out;
      }
    }
  } catch { /* fall through to null */ }
  abiCache.set(key, null);
  return null;
}

/** Resolve a 4-byte selector to a text signature via the 4byte directory. When
 *  several signatures collide on a selector, prefer the lowest id (the earliest
 *  / most canonical registration). Returns null on miss/failure. Cached. */
async function fetch4byteSig(selector: string): Promise<string | null> {
  const hit = sigCache.get(selector);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`${FOURBYTE_BASE}?hex_signature=${selector}`);
    if (res.ok) {
      const json = (await res.json()) as {
        results?: Array<{ id: number; text_signature: string }>;
      };
      const best = (json.results ?? []).sort((a, b) => a.id - b.id)[0];
      if (best?.text_signature) {
        sigCache.set(selector, best.text_signature);
        return best.text_signature;
      }
    }
  } catch { /* fall through */ }
  sigCache.set(selector, null);
  return null;
}

/** Decode `call.data` for `to` on `chainId` into a function + named args.
 *  Network-backed; never throws — every failure path returns a `decoded:false`
 *  result the card renders as "could not decode" with the raw selector. */
export async function decodeCall(
  to: string | undefined, data: string | undefined, chainId: number,
): Promise<DecodedCall> {
  const selector = selectorOf(data);
  if (!selector || !to) {
    return { decoded: false, verified: false, source: 'none', args: [], selector, note: 'No calldata to decode.' };
  }

  // 1. Sourcify ABI -> exact name + named args.
  const sourcify = await fetchSourcifyAbi(chainId, to);
  if (sourcify) {
    try {
      const decoded = decodeFunctionData({ abi: sourcify.abi, data: data as Hex });
      const fn = sourcify.abi.find(
        (i): i is Extract<Abi[number], { type: 'function' }> =>
          i.type === 'function' && i.name === decoded.functionName,
      );
      const inputs = fn?.inputs ?? [];
      const args = (decoded.args ?? []).map((v, i) => ({
        name: inputs[i]?.name || `arg${i}`,
        type: inputs[i]?.type || '',
        value: fmtArg(v),
      }));
      const signature = fn
        ? `${fn.name}(${inputs.map(p => p.type).join(',')})`
        : decoded.functionName;
      return {
        decoded: true,
        verified: sourcify.verified,
        source: 'sourcify',
        functionName: decoded.functionName,
        signature,
        args,
        selector,
        note: undefined,
      };
    } catch { /* ABI present but didn't match this selector — fall to 4byte */ }
  }

  // 2. 4byte fallback -> signature + best-effort arg decode (unverified).
  const sig = await fetch4byteSig(selector);
  if (sig) {
    let args: DecodedArg[] = [];
    try {
      const item = parseAbiItem(`function ${sig}`) as Extract<Abi[number], { type: 'function' }>;
      // Guard the selector actually matches (4byte can return collisions).
      if (toFunctionSelector(item).toLowerCase() === selector) {
        const decoded = decodeFunctionData({ abi: [item] as Abi, data: data as Hex });
        args = (decoded.args ?? []).map((v, i) => ({
          name: item.inputs[i]?.name || `arg${i}`,
          type: item.inputs[i]?.type || '',
          value: fmtArg(v),
        }));
      }
    } catch { /* keep name only */ }
    return {
      decoded: true,
      verified: false,
      source: '4byte',
      functionName: sig.split('(')[0],
      signature: sig,
      args,
      selector,
      note: 'Decoded via function signature.',
    };
  }

  // 3. Nothing matched.
  return {
    decoded: false,
    verified: false,
    source: 'none',
    args: [],
    selector,
    note: 'Could not decode this call.',
  };
}

/** Hook for the card: decodes `data` for `to` on `chainId` and returns the
 *  current state. `pending` is true while the fetch is in flight (the card shows
 *  the raw calldata meanwhile); a network failure resolves to a `decoded:false`
 *  result, never throwing. Only runs for a contract call (has data) — a plain
 *  ETH transfer returns null so the caller keeps its simple transfer view. */
export function useDecodedCall(
  to: string | undefined, data: string | undefined, chainId: number,
): { call: DecodedCall | null; pending: boolean } {
  const hasData = !!data && data !== '0x' && data.length > 2;
  const [call, setCall] = useState<DecodedCall | null>(null);
  const [pending, setPending] = useState(hasData);
  useEffect(() => {
    if (!hasData) { setCall(null); setPending(false); return; }
    let alive = true;
    setPending(true);
    void decodeCall(to, data, chainId).then(r => {
      if (alive) { setCall(r); setPending(false); }
    });
    return () => { alive = false; };
  }, [to, data, chainId, hasData]);
  return { call, pending };
}

/** A real, red "check before signing" warning — reserved for genuinely risky
 *  cases so we inform without crying wolf. We do NOT warn merely because a
 *  contract resolved via 4byte instead of Sourcify (that's a calm, informative
 *  decode — see DecodedCallBlock's neutral "decoded via function signature" note).
 *
 *  A warning fires ONLY when:
 *   1. the calldata is genuinely undecodable (no Sourcify, no 4byte match) — we
 *      truly cannot tell the user what the tx does; or
 *   2. there's a clear mismatch: the sender's description claims a payment/transfer
 *      but the decoded function is clearly not a transfer.
 *  Otherwise (confident decode, signatures consistent) we show the decode calmly
 *  with no banner at all. */
export function spoofWarning(call: DecodedCall | null, description?: string): string | undefined {
  if (!call) return undefined; // plain ETH transfer — handled by the simple view
  if (!call.decoded) {
    return 'This call could not be decoded, so the app cannot confirm what it does. Check before signing.';
  }
  // We HAVE a confident decode (Sourcify or a verified 4byte signature). The only
  // remaining risk worth a banner is a description that contradicts the action.
  const desc = (description ?? '').toLowerCase();
  const claimsTransfer = /\b(send|sent|pay|paid|payment|transfer)\b|\$|usdc|eth\b/.test(desc);
  const fn = (call.functionName ?? '').toLowerCase();
  const isTransfer = /transfer|send|pay/.test(fn);
  if (desc && claimsTransfer && !isTransfer) {
    return `The sender describes a payment, but this call runs ${call.functionName}(). Check before signing.`;
  }
  return undefined;
}
