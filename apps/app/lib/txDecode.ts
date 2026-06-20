/** @file Async calldata decoder for the tx-request card resolving the ABI (Sourcify, then 4byte, then raw selector) for a trustworthy function+args view; never blocks signing (failures return decoded:false with the raw selector) and caches per (chainId+address) and per selector. */

import { useEffect, useState } from 'react';
import {
  decodeFunctionData, parseAbiItem, toFunctionSelector, type Abi, type Hex,
} from 'viem';

/** One decoded argument: a name (from the ABI, or `arg0` when unnamed via 4byte) and a display-ready string value. */
interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface DecodedCall {
  /** True when we resolved a function name + decoded the args (Sourcify or 4byte). */
  decoded: boolean;
  /** True when the contract's SOURCE is verified on Sourcify (full OR partial match) — the ABI is authentic. Drives whether we show a calm decode vs any caution. False for a 4byte-only / undecodable resolve. */
  verified: boolean;
  /** How the ABI resolved: 'sourcify' (authentic verified ABI), '4byte' (signature only), 'mismatch' (verified contract lacks this selector — red do-not-sign warning), or 'none' (undecodable). */
  source: 'sourcify' | '4byte' | 'mismatch' | 'none';
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

/** Sourcify v2 contract API returns the ABI + match status in one call with no redirect, unlike the legacy host whose 307 redirect made RN fetch unreliable and falsely dropped verified contracts to 4byte. */
const SOURCIFY_BASE = 'https://sourcify.dev/server/v2/contract';
const FOURBYTE_BASE = 'https://www.4byte.directory/api/v1/signatures/';

/** Per (chainId:address) -> resolved ABI (or null when the contract is not verified on Sourcify). In-memory; lives for the app session. */
const abiCache = new Map<string, { abi: Abi; verified: boolean } | null>();
/** Per selector -> text signature from 4byte (or null when unknown). */
const sigCache = new Map<string, string | null>();

/** Selector Of. */
function selectorOf(data?: string): string | undefined {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return undefined;
  return data.slice(0, 10).toLowerCase();
}

/** Convert an object to its default string form, preserving any custom `toString`, without tripping no-base-to-string on a bare `String(obj)`. */
function safeObjectToString(v: object): string {
  const fn: unknown = (v as { toString?: unknown }).toString;
  if (typeof fn === 'function') {
    const out: unknown = (fn as () => unknown).call(v);
    if (typeof out === 'string') return out;
  }
  return Object.prototype.toString.call(v);
}

/** Stringify a decoded arg value for display (BigInt-safe, address-preserving). */
function fmtArg(v: unknown): string {
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.map(fmtArg).join(', ')}]`;
  if (v && typeof v === 'object') {
    try { return JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? x.toString() : x)); }
    catch { return safeObjectToString(v); }
  }
  return String(v);
}

/** Fetch the verified ABI for `address` on `chainId` from Sourcify v2, where any `match` (full or partial) means the source is verified and the ABI authentic; returns null when absent or the fetch fails (cached). */
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
      /** `match` is 'exact_match' | 'match' (full/partial) when verified, null otherwise. */
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

/** Resolve a 4-byte selector to a text signature via the 4byte directory. When several signatures collide on a selector, prefer the lowest id (the earliest / most canonical registration). Returns null on miss/failure. Cached. */
async function fetch4byteSig(selector: string): Promise<string | null> {
  const hit = sigCache.get(selector);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(`${FOURBYTE_BASE}?hex_signature=${selector}`);
    if (res.ok) {
      const json = (await res.json()) as {
        results?: { id: number; text_signature: string }[];
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

/** Map a decoded function's raw args into display-ready DecodedArg list given its ABI inputs. */
function mapDecodedArgs(
  rawArgs: readonly unknown[] | undefined,
  inputs: readonly { name?: string; type: string }[],
): DecodedArg[] {
  return (rawArgs ?? []).map((v, i) => {
    const input = inputs[i];
    const argName = input?.name;
    return {
      name: argName !== undefined && argName.length > 0 ? argName : `arg${i}`,
      type: input?.type ?? '',
      value: fmtArg(v),
    };
  });
}

/** True when the ABI contains a function whose selector matches `selector`. */
function abiHasSelector(abi: Abi, selector: string): boolean {
  return abi.some((i) => {
    if (i.type !== 'function') return false;
    try { return toFunctionSelector(i).toLowerCase() === selector; }
    catch { return false; }
  });
}

/** Decode against a verified Sourcify ABI known to contain `selector`, or null when args won't decode. */
function decodeWithSourcify(
  abi: Abi, verified: boolean, data: string, selector: string,
): DecodedCall | null {
  try {
    const decoded = decodeFunctionData({ abi, data: data as Hex });
    const fn = abi.find(
      (i): i is Extract<Abi[number], { type: 'function' }> =>
        i.type === 'function' && i.name === decoded.functionName,
    );
    const inputs = fn?.inputs ?? [];
    return {
      decoded: true,
      verified,
      source: 'sourcify',
      functionName: decoded.functionName,
      signature: fn ? `${fn.name}(${inputs.map(p => p.type).join(',')})` : decoded.functionName,
      args: mapDecodedArgs(decoded.args, inputs),
      selector,
      note: undefined,
    };
  } catch {
    return null; /** selector is in the ABI but args failed to decode — caller treats as mismatch */
  }
}

/** Build the RED "selector not on this verified contract" mismatch result (4byte guess used for display only). */
async function buildMismatch(verified: boolean, selector: string): Promise<DecodedCall> {
  const guessSig = await fetch4byteSig(selector);
  const guess = guessSig ? `looks like ${guessSig} per 4byte, but ` : '';
  return {
    decoded: false,
    verified,
    source: 'mismatch',
    functionName: guessSig ? guessSig.split('(')[0] : undefined,
    signature: guessSig ?? undefined,
    args: [],
    selector,
    note: `This calls a function that does not exist on this verified contract (selector ${selector}). ${guess ? `${guess.charAt(0).toUpperCase()}${guess.slice(1)}` : 'The '}this contract has no such function. The transaction will likely fail or is malformed - do not sign unless you trust it.`,
  };
}

/** Resolve a call against a verified Sourcify contract: a calm decode when the selector is implemented, else a mismatch warning. */
async function decodeViaSourcify(
  abi: Abi, verified: boolean, data: string, selector: string,
): Promise<DecodedCall> {
  /** Load-bearing check: if the verified ABI has no function with this selector the tx targets a function the contract doesn't implement (will revert / malformed), so we must NOT fall back to 4byte and render a confident decode. */
  if (abiHasSelector(abi, selector)) {
    const calm = decodeWithSourcify(abi, verified, data, selector);
    if (calm) return calm;
  }
  return buildMismatch(verified, selector);
}

/** Best-effort decode args from a 4byte text signature; empty when the signature can't be parsed or the selector doesn't match. */
function decode4byteArgs(sig: string, data: string, selector: string): DecodedArg[] {
  try {
    const item = parseAbiItem(`function ${sig}`) as Extract<Abi[number], { type: 'function' }>;
    /** Guard the selector actually matches (4byte can return collisions). */
    if (toFunctionSelector(item).toLowerCase() !== selector) return [];
    const decoded = decodeFunctionData({ abi: [item] as Abi, data: data as Hex });
    return mapDecodedArgs(decoded.args, item.inputs);
  } catch {
    return []; /** keep name only */
  }
}

/** Resolve a call via the 4byte directory (unverified signature + best-effort args), or null on a miss. */
async function decodeVia4byte(data: string, selector: string): Promise<DecodedCall | null> {
  const sig = await fetch4byteSig(selector);
  if (!sig) return null;
  return {
    decoded: true,
    verified: false,
    source: '4byte',
    functionName: sig.split('(')[0],
    signature: sig,
    args: decode4byteArgs(sig, data, selector),
    selector,
    note: 'Decoded via function signature.',
  };
}

/** Decode `call.data` for `to` on `chainId` into a function + named args. Network-backed; never throws — every failure path returns a `decoded:false` result the card renders as "could not decode" with the raw selector. */
export async function decodeCall(
  to: string | undefined, data: string | undefined, chainId: number,
): Promise<DecodedCall> {
  const selector = selectorOf(data);
  /** `selector` is only defined when `data` is a hex string; the `!data` arm narrows the type without changing behaviour. */
  if (!selector || !to || !data) {
    return { decoded: false, verified: false, source: 'none', args: [], selector, note: 'No calldata to decode.' };
  }

  /** 1. Sourcify ABI -> exact name + named args (or a mismatch warning). */
  const sourcify = await fetchSourcifyAbi(chainId, to);
  if (sourcify) {
    return decodeViaSourcify(sourcify.abi, sourcify.verified, data, selector);
  }

  /** 2. 4byte fallback -> signature + best-effort arg decode (unverified). */
  const fourByte = await decodeVia4byte(data, selector);
  if (fourByte) return fourByte;

  /** 3. Nothing matched. */
  return {
    decoded: false,
    verified: false,
    source: 'none',
    args: [],
    selector,
    note: 'Could not decode this call.',
  };
}

/** Card hook: decodes `data` for `to` on `chainId`, exposing `pending` while in flight (failures resolve to decoded:false, never throwing) and returning null for a plain ETH transfer so the caller keeps its simple view. */
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

/** A red "check before signing" warning fired only for genuinely risky cases — selector mismatch on a verified contract, undecodable calldata, or a description claiming a payment while the decoded function isn't a transfer — not merely for a 4byte resolve. */
export function spoofWarning(call: DecodedCall | null, description?: string): string | undefined {
  if (!call) return undefined; /** plain ETH transfer — handled by the simple view */
  /** Selector-not-in-ABI on a verified contract: surface the explicit "do not sign" note from the decode (it names the selector and the 4byte guess if any). */
  if (call.source === 'mismatch') {
    return call.note ?? 'This calls a function that does not exist on this verified contract. Do not sign unless you trust it.';
  }
  if (!call.decoded) {
    return 'This call could not be decoded, so the app cannot confirm what it does. Check before signing.';
  }
  /** With a confident decode the only remaining risk worth a banner is a description that contradicts the action. */
  const desc = (description ?? '').toLowerCase();
  const claimsTransfer = /\b(send|sent|pay|paid|payment|transfer)\b|\$|usdc|eth\b/.test(desc);
  const fn = (call.functionName ?? '').toLowerCase();
  const isTransfer = /transfer|send|pay/.test(fn);
  if (desc && claimsTransfer && !isTransfer) {
    return `The sender describes a payment, but this call runs ${call.functionName}(). Check before signing.`;
  }
  return undefined;
}
