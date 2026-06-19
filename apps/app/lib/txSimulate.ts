/**
 * @file Pre-sign transaction simulation via eth_simulateV1: reports success/revert (with reason) and the ETH/ERC-20 in/out movements for a tx against current chain state.
 *  Uses broviderRpc with traceTransfers + validation:false; for smart accounts it simulates the inner call from the account address, and never throws (errors resolve to `{ success: 'unknown' }`).
 */

import { useEffect, useState } from 'react';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { getAddress } from 'viem';
import { getActiveAccount } from './accounts';
import {
  parseAssetChanges, decodeRevert, insufficientEthReason,
  type AssetMove, type SimCall,
} from './txSimulate.parse';

export type { AssetMove } from './txSimulate.parse';

export interface SimulateResult {
  /** true = will succeed, false = will revert, 'unknown' = could not simulate. */
  success: boolean | 'unknown';
  /** Decoded revert reason when success === false (best-effort). */
  revertReason?: string;
  /** Net asset movement relative to `from`: `out` leaves the account, `in` arrives. Empty arrays = no balance changes (e.g. a Poster post). */
  assetChanges: { in: AssetMove[]; out: AssetMove[] };
  /** Set when success === 'unknown' — the underlying RPC/parse failure. */
  error?: string;
}

interface SimulateParams {
  /** The sender to simulate from. For the smart account, pass its address. */
  from: string;
  to: string;
  /** Hex wei value, e.g. "0x0". Optional. */
  value?: string;
  /** Calldata. Optional (plain ETH send has none). */
  data?: string;
  chainId: number;
}

/** Minimal JSON-RPC POST to brovider. Returns the parsed body, or a thrown Error on transport failure. Caller distinguishes a JSON-RPC `error` (the node refused/failed the method) from a successful `result`. */
interface RpcResponse {
  result?: unknown;
  error?: { message?: string; data?: string };
}
/** Rpc helper. */
async function rpc(chainId: number, method: string, params: unknown[]): Promise<RpcResponse> {
  const res = await fetch(broviderRpc(chainId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await res.json()) as RpcResponse;
}

/**
 * PRE-CHECK a native ETH value transfer against the sender's on-chain balance.
 *  Returns a `success:false` result with a clear "insufficient ETH (have/need)"
 *  reason when value > balance, or null when the balance covers it (so the full
 *  simulation proceeds). null on any RPC error too (don't block on a flaky read).
 *  This catches the common 0-balance send that eth_simulateV1 reports as a vague
 *  failure.
 */
async function checkNativeBalance(
  from: string, valueHex: string, chainId: number,
): Promise<SimulateResult | null> {
  let value: bigint;
  try { value = BigInt(valueHex); } catch { return null; }
  if (value <= 0n) return null;
  let balance: bigint;
  try {
    const j = await rpc(chainId, 'eth_getBalance', [from, 'latest']);
    if (j.error || typeof j.result !== 'string' || !j.result) return null;
    balance = BigInt(j.result);
  } catch { return null; }
  if (value <= balance) return null;
  return {
    success: false,
    revertReason: insufficientEthReason(balance, value, chainId),
    assetChanges: { in: [], out: [] },
  };
}

/** Best-effort eth_call to extract a revert reason when eth_simulateV1 itself errored (method/RPC failure, not a clean simulated revert). Returns the decoded reason, or null when the call SUCCEEDS (no revert) or can't be read. */
async function callForRevert(
  call: { from: string; to: string; value: string; data?: string }, chainId: number,
): Promise<string | null> {
  try {
    const j = await rpc(chainId, 'eth_call', [call, 'latest']);
    if (!j.error) return null; // call didn't revert -> no reason to surface
    const data = j.error.data;
    return decodeRevert(typeof data === 'string' ? data : undefined, j.error.message) ?? null;
  } catch { return null; }
}

/** Simulate a single call with eth_simulateV1 and return success + asset moves. Never throws — RPC/parse failures resolve to `{ success: 'unknown', error }`. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
async function simulateTx(p: SimulateParams): Promise<SimulateResult> {
  const empty = { in: [], out: [] };
  let from: string, to: string;
  try {
    from = getAddress(p.from);
    to = getAddress(p.to);
  } catch {
    return { success: 'unknown', assetChanges: empty, error: 'Invalid address' };
  }

  const valueHex = p.value && p.value !== '0x' ? p.value : '0x0';
  // PRE-CHECK: a plain native ETH send (value, no calldata) against the sender's
  // balance. Surfaces the exact "insufficient ETH (have X, need Y)" before we
  // even simulate — the 0-balance-send case that otherwise read as "cannot
  // simulate".
  if (!p.data || p.data === '0x') {
    const pre = await checkNativeBalance(from, valueHex, p.chainId);
    if (pre) return pre;
  }

  const call = {
    from,
    to,
    value: valueHex,
    ...(p.data && p.data !== '0x' ? { data: p.data } : {}),
  };
  // eth_simulateV1 returns one block object per blockStateCall; each block carries
  // its per-call results under `.calls` (NOT as a bare array). We send one block
  // with one call, so the result is result[0].calls[0].
  let json: { result?: { calls?: SimCall[] }[]; error?: { message?: string } };
  try {
    const resp = await rpc(p.chainId, 'eth_simulateV1', [
      { blockStateCalls: [{ calls: [call] }], traceTransfers: true, validation: false },
      'latest',
    ]);
    json = {
      result: Array.isArray(resp.result) ? (resp.result as { calls?: SimCall[] }[]) : undefined,
      error: resp.error,
    };
  } catch (e) {
    return {
      success: 'unknown', assetChanges: empty,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }

  // A JSON-RPC error here is a REAL method/RPC failure (not a simulated revert).
  // Reserve "could not simulate" for this path — but first fall back to eth_call
  // to try to surface the actual revert reason, so a node that lacks
  // eth_simulateV1 still shows "Will fail: <reason>" when the tx truly reverts.
  if (json.error || !json.result) {
    const reason = await callForRevert(call, p.chainId);
    if (reason) return { success: false, revertReason: reason, assetChanges: empty };
    return {
      success: 'unknown', assetChanges: empty,
      error: json.error?.message ?? 'Simulation unavailable',
    };
  }

  const allCalls = json.result.flatMap(b => b.calls ?? []);
  const c = allCalls[0];
  if (!c) return { success: 'unknown', assetChanges: empty, error: 'Empty simulation result' };

  const ok = c.status === '0x1';
  const assetChanges = parseAssetChanges(allCalls, from, p.chainId, call.value);
  if (!ok) {
    return {
      success: false,
      revertReason: decodeRevert(c.returnData, c.error?.message) ?? 'Transaction would revert',
      assetChanges,
    };
  }
  return { success: true, assetChanges };
}

/**
 * React hook: run a pre-sign simulation for the active account against a call.
 *
 *  Resolves the sender from the ACTIVE account (the smart-account address for a
 *  smart wallet, the EOA address otherwise) so the simulation runs from the same
 *  identity that will actually sign. While the active address loads / the
 *  simulation is in flight, `pending` is true (card shows "Simulating…"). The
 *  call key (to/data/value/chainId) drives a re-run; an absent `to` no-ops.
 */
export function useTxSimulation(
  to: string | undefined,
  data: string | undefined,
  value: string | undefined,
  chainId: number,
): { result: SimulateResult | null; pending: boolean } {
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [pending, setPending] = useState<boolean>(!!to);
  useEffect(() => {
    if (!to) { setResult(null); setPending(false); return; }
    let alive = true;
    setPending(true);
    void (async () => {
      const active = await getActiveAccount();
      const from = active?.address;
      if (!from) {
        if (alive) {
          setResult({ success: 'unknown', assetChanges: { in: [], out: [] }, error: 'No active wallet' });
          setPending(false);
        }
        return;
      }
      const r = await simulateTx({ from, to, data, value, chainId });
      if (alive) { setResult(r); setPending(false); }
    })();
    return () => { alive = false; };
  }, [to, data, value, chainId]);
  return { result, pending };
}
