/** Pure parse + format helpers for the pre-sign simulation (lib/txSimulate).
 *
 *  Split out so the log → asset-delta math is unit-testable WITHOUT pulling in
 *  the RN-bound account/RPC layer (lib/accounts → react-native). No React, no
 *  network, no key material here — just bytes in, AssetMove out. */

import { ASSETS, NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { decodeAbiParameters, type Hex } from 'viem';

/** keccak256("Transfer(address,address,uint256)") — the ERC-20 / synthetic-ETH
 *  transfer topic that traceTransfers emits. */
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** One side of the asset delta shown on the card. */
export interface AssetMove {
  /** Token contract address, or the native sentinel for ETH. */
  token: string;
  /** Resolved symbol (registry) or a short address fallback. */
  symbol: string;
  /** Human-readable amount string (already scaled by decimals). */
  amount: string;
  decimals: number;
}

export interface SimLog { address: string; topics: string[]; data: string }
export interface SimCall {
  status: string;
  returnData?: string;
  logs?: SimLog[];
  error?: { message?: string; data?: string };
}

/** Decode a standard `Error(string)` revert payload (0x08c379a0 selector) into
 *  its message; falls back to a generic note for `Panic(uint256)` / opaque data. */
export function decodeRevert(returnData?: string, errMsg?: string): string | undefined {
  const d = returnData && returnData !== '0x' ? returnData : undefined;
  if (d && d.startsWith('0x08c379a0')) {
    try {
      const [msg] = decodeAbiParameters([{ type: 'string' }], ('0x' + d.slice(10)) as Hex);
      if (msg) return String(msg);
    } catch { /* fall through */ }
  }
  if (d && d.startsWith('0x4e487b71')) return 'Execution panic (assert/overflow)';
  if (errMsg) return errMsg;
  return undefined;
}

/** Symbol/decimals for a token contract from the static registry; short-address
 *  + 18-decimal fallback when unknown. Registry-only by design (no extra RPC). */
function tokenMeta(addr: string, chainId: number): { symbol: string; decimals: number } {
  const lc = addr.toLowerCase();
  const hit = ASSETS.find(a => a.chainId === chainId && a.address && a.address.toLowerCase() === lc);
  if (hit) return { symbol: hit.symbol, decimals: hit.decimals };
  return { symbol: `${addr.slice(0, 6)}…${addr.slice(-4)}`, decimals: 18 };
}

/** The native asset's symbol/decimals for the chain (ETH everywhere we support). */
function nativeMeta(chainId: number): { symbol: string; decimals: number } {
  const hit = ASSETS.find(a => a.chainId === chainId && a.address === null);
  return { symbol: hit?.symbol ?? 'ETH', decimals: hit?.decimals ?? 18 };
}

/** Format a raw bigint amount by decimals into a trimmed decimal string. */
export function formatAmount(raw: bigint, decimals: number): string {
  if (raw < 0n) raw = -raw;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return whole.toString();
  let fs = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fs.length > 6) fs = fs.slice(0, 6); // cap displayed precision
  return `${whole.toString()}.${fs}`;
}

/** Extract a lowercased 20-byte address from a 32-byte log topic. */
function topicToAddr(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase();
}

/** Net the simulation's transfer logs (ERC-20 + synthetic native) into a signed
 *  per-token delta relative to `from`, split into in/out lists. */
export function parseAssetChanges(
  calls: SimCall[],
  from: string,
  chainId: number,
  topValue?: string,
): { in: AssetMove[]; out: AssetMove[] } {
  const me = from.toLowerCase();
  const net = new Map<string, bigint>(); // '' = native, else lowercased contract
  const add = (token: string, delta: bigint): void => {
    net.set(token, (net.get(token) ?? 0n) + delta);
  };

  for (const c of calls) {
    for (const log of c.logs ?? []) {
      if (!log.topics?.length) continue;
      if (log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
      if (log.topics.length < 3) continue;
      const fromA = topicToAddr(log.topics[1]);
      const toA = topicToAddr(log.topics[2]);
      let amount: bigint;
      try { amount = BigInt(log.data && log.data !== '0x' ? log.data : '0x0'); }
      catch { continue; }
      if (amount === 0n) continue;
      const emitter = (log.address ?? '').toLowerCase();
      const isNative =
        emitter === '' ||
        emitter === '0x0000000000000000000000000000000000000000' ||
        emitter === NATIVE_TOKEN_SENTINEL.toLowerCase();
      const key = isNative ? '' : emitter;
      if (toA === me) add(key, amount);
      if (fromA === me) add(key, -amount);
    }
  }

  // Fold the top-level native value as OUT when no synthetic log covered it.
  if (topValue) {
    try {
      const v = BigInt(topValue);
      if (v > 0n && (net.get('') ?? 0n) === 0n) add('', -v);
    } catch { /* ignore */ }
  }

  const out: AssetMove[] = [];
  const incoming: AssetMove[] = [];
  for (const [key, delta] of net) {
    if (delta === 0n) continue;
    const meta = key === '' ? nativeMeta(chainId) : tokenMeta(key, chainId);
    const move: AssetMove = {
      token: key === '' ? NATIVE_TOKEN_SENTINEL : key,
      symbol: meta.symbol,
      decimals: meta.decimals,
      amount: formatAmount(delta, meta.decimals),
    };
    if (delta < 0n) out.push(move); else incoming.push(move);
  }
  return { in: incoming, out };
}
