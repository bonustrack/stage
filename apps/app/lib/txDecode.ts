
import { useEffect, useState } from 'react';
import {
  decodeFunctionData, parseAbiItem, toFunctionSelector, type Abi, type Hex,
} from 'viem';

interface DecodedArg {
  name: string;
  type: string;
  value: string;
}

export interface DecodedCall {
  decoded: boolean;
  verified: boolean;
  source: 'sourcify' | '4byte' | 'mismatch' | 'none';
  functionName?: string;
  signature?: string;
  args: DecodedArg[];
  selector?: string;
  note?: string;
}

const SOURCIFY_BASE = 'https://sourcify.dev/server/v2/contract';
const FOURBYTE_BASE = 'https://www.4byte.directory/api/v1/signatures/';

const abiCache = new Map<string, { abi: Abi; verified: boolean } | null>();
const sigCache = new Map<string, string | null>();

function selectorOf(data?: string): string | undefined {
  if (!data || !/^0x[0-9a-fA-F]{8}/.test(data)) return undefined;
  return data.slice(0, 10).toLowerCase();
}

function safeObjectToString(v: object): string {
  const fn: unknown = (v as { toString?: unknown }).toString;
  if (typeof fn === 'function') {
    const out: unknown = (fn as () => unknown).call(v);
    if (typeof out === 'string') return out;
  }
  return Object.prototype.toString.call(v);
}

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
      if (Array.isArray(abi) && abi.length && meta.match) {
        const out = { abi, verified: true };
        abiCache.set(key, out);
        return out;
      }
    }
  } catch { }
  abiCache.set(key, null);
  return null;
}

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
  } catch { }
  sigCache.set(selector, null);
  return null;
}

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

function abiHasSelector(abi: Abi, selector: string): boolean {
  return abi.some((i) => {
    if (i.type !== 'function') return false;
    try { return toFunctionSelector(i).toLowerCase() === selector; }
    catch { return false; }
  });
}

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
    return null;
  }
}

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

async function decodeViaSourcify(
  abi: Abi, verified: boolean, data: string, selector: string,
): Promise<DecodedCall> {
  if (abiHasSelector(abi, selector)) {
    const calm = decodeWithSourcify(abi, verified, data, selector);
    if (calm) return calm;
  }
  return buildMismatch(verified, selector);
}

function decode4byteArgs(sig: string, data: string, selector: string): DecodedArg[] {
  try {
    const item = parseAbiItem(`function ${sig}`) as Extract<Abi[number], { type: 'function' }>;
    if (toFunctionSelector(item).toLowerCase() !== selector) return [];
    const decoded = decodeFunctionData({ abi: [item] as Abi, data: data as Hex });
    return mapDecodedArgs(decoded.args, item.inputs);
  } catch {
    return [];
  }
}

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

export async function decodeCall(
  to: string | undefined, data: string | undefined, chainId: number,
): Promise<DecodedCall> {
  const selector = selectorOf(data);
  if (!selector || !to || !data) {
    return { decoded: false, verified: false, source: 'none', args: [], selector, note: 'No calldata to decode.' };
  }

  const sourcify = await fetchSourcifyAbi(chainId, to);
  if (sourcify) {
    return decodeViaSourcify(sourcify.abi, sourcify.verified, data, selector);
  }

  const fourByte = await decodeVia4byte(data, selector);
  if (fourByte) return fourByte;

  return {
    decoded: false,
    verified: false,
    source: 'none',
    args: [],
    selector,
    note: 'Could not decode this call.',
  };
}

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

export function spoofWarning(call: DecodedCall | null, description?: string): string | undefined {
  if (!call) return undefined;
  if (call.source === 'mismatch') {
    return call.note ?? 'This calls a function that does not exist on this verified contract. Do not sign unless you trust it.';
  }
  if (!call.decoded) {
    return 'This call could not be decoded, so the app cannot confirm what it does. Check before signing.';
  }
  const desc = (description ?? '').toLowerCase();
  const claimsTransfer = /\b(send|sent|pay|paid|payment|transfer)\b|\$|usdc|eth\b/.test(desc);
  const fn = (call.functionName ?? '').toLowerCase();
  const isTransfer = /transfer|send|pay/.test(fn);
  if (desc && claimsTransfer && !isTransfer) {
    return `The sender describes a payment, but this call runs ${call.functionName}(). Check before signing.`;
  }
  return undefined;
}
