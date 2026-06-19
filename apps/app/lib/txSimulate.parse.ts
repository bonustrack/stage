/**
 * @file Pure log → asset-delta parse + format helpers for the pre-sign simulation, split out so the math is unit-testable without the RN-bound account/RPC layer.
 *  No React, no network, no key material — bytes in, AssetMove out.
 */

import { ASSETS, NATIVE_TOKEN_SENTINEL } from '@stage-labs/client/wallet/assets';
import { decodeAbiParameters, type Hex } from 'viem';

/** keccak256("Transfer(address,address,uint256)") — the ERC-20 / synthetic-ETH transfer topic that traceTransfers emits. */
const TRANSFER_TOPIC =
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

interface SimLog { address: string; topics: string[]; data: string }
export interface SimCall {
  status: string;
  returnData?: string;
  logs?: SimLog[];
  error?: { message?: string; data?: string };
}

/**
 * Normalise a raw revert/RPC message into a short, human reason. Recognises the
 *  common cases the node surfaces as free text (insufficient funds/balance, gas,
 *  generic "execution reverted") so the card reads "Will fail: insufficient
 *  funds" instead of a node-specific blob. Returns the input trimmed when no
 *  pattern matches.
 */
export function humanizeRevert(raw: string): string {
  const s = raw.trim();
  const lc = s.toLowerCase();
  if (lc.includes('insufficient funds')) return 'insufficient ETH for value + gas';
  if (lc.includes('insufficient balance') || lc.includes('transfer amount exceeds balance')) {
    return 'insufficient token balance';
  }
  if (lc.includes('insufficient allowance') || lc.includes('exceeds allowance')) {
    return 'insufficient token allowance (approve first)';
  }
  if (lc.includes('intrinsic gas') || lc.includes('out of gas')) return 'out of gas';
  if (lc === 'execution reverted' || lc === 'reverted') return 'transaction would revert';
  return s;
}

/** Decode a standard `Error(string)` revert payload (0x08c379a0 selector) into its message; falls back to a generic note for `Panic(uint256)` / opaque data. The decoded/RPC message is run through {@link humanizeRevert} so common failures read cleanly. */
export function decodeRevert(returnData?: string, errMsg?: string): string | undefined {
  const d = returnData && returnData !== '0x' ? returnData : undefined;
  if (d?.startsWith('0x08c379a0')) {
    try {
      const [msg] = decodeAbiParameters([{ type: 'string' }], ('0x' + d.slice(10)) as Hex);
      if (msg) return humanizeRevert(msg);
    } catch { /* fall through */ }
  }
  if (d?.startsWith('0x4e487b71')) return 'Execution panic (assert/overflow)';
  if (errMsg) return humanizeRevert(errMsg);
  return undefined;
}

/** Symbol/decimals for a token contract from the static registry; short-address + 18-decimal fallback when unknown. Registry-only by design (no extra RPC). */
function tokenMeta(addr: string, chainId: number): { symbol: string; decimals: number } {
  const lc = addr.toLowerCase();
  const hit = ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
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

/** Build the "insufficient ETH" reason for a native-value transfer whose value exceeds the sender's balance: "insufficient ETH (have X, need Y)". Pure (wei in, string out) so it's unit-testable without the RPC. */
export function insufficientEthReason(balanceWei: bigint, valueWei: bigint, chainId: number): string {
  const { symbol, decimals } = nativeMeta(chainId);
  return `insufficient ${symbol} (have ${formatAmount(balanceWei, decimals)}, need ${formatAmount(valueWei, decimals)})`;
}

/** Extract a lowercased 20-byte address from a 32-byte log topic. */
function topicToAddr(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase();
}

/** Net the simulation's transfer logs (ERC-20 + synthetic native) into a signed per-token delta relative to `from`, split into in/out lists. */
export function parseAssetChanges(
  calls: SimCall[],
  from: string,
  chainId: number,
  topValue?: string,
): { in: AssetMove[]; out: AssetMove[] } {
  const me = from.toLowerCase();
  const net = new Map<string, bigint>(); // '' = native, else lowercased contract
  /** Add helper. */
  const add = (token: string, delta: bigint): void => {
    net.set(token, (net.get(token) ?? 0n) + delta);
  };

  for (const c of calls) {
    for (const log of c.logs ?? []) {
      const topics = log.topics;
      if (!topics?.length) continue;
      if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
      if (topics.length < 3) continue;
      const topic1 = topics[1];
      const topic2 = topics[2];
      if (topic1 === undefined || topic2 === undefined) continue;
      const fromA = topicToAddr(topic1);
      const toA = topicToAddr(topic2);
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
