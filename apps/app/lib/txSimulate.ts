
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
  success: boolean | 'unknown';
  revertReason?: string;
  assetChanges: { in: AssetMove[]; out: AssetMove[] };
  error?: string;
}

interface SimulateParams {
  from: string;
  to: string;
  value?: string;
  data?: string;
  chainId: number;
}

interface RpcResponse {
  result?: unknown;
  error?: { message?: string; data?: string };
}
async function rpc(chainId: number, method: string, params: unknown[]): Promise<RpcResponse> {
  const res = await fetch(broviderRpc(chainId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await res.json()) as RpcResponse;
}

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

async function callForRevert(
  call: { from: string; to: string; value: string; data?: string }, chainId: number,
): Promise<string | null> {
  try {
    const j = await rpc(chainId, 'eth_call', [call, 'latest']);
    if (!j.error) return null;
    const data = j.error.data;
    return decodeRevert(typeof data === 'string' ? data : undefined, j.error.message) ?? null;
  } catch { return null; }
}

interface SimCallInput { from: string; to: string; value: string; data?: string }

interface SimV1Response { result?: { calls?: SimCall[] }[]; error?: { message?: string } }

async function runSimulateV1(call: SimCallInput, chainId: number): Promise<SimV1Response> {
  const resp = await rpc(chainId, 'eth_simulateV1', [
    { blockStateCalls: [{ calls: [call] }], traceTransfers: true, validation: false },
    'latest',
  ]);
  return {
    result: Array.isArray(resp.result) ? (resp.result as { calls?: SimCall[] }[]) : undefined,
    error: resp.error,
  };
}

function interpretSimResult(
  json: SimV1Response, from: string, call: SimCallInput, chainId: number,
): SimulateResult {
  const empty = { in: [], out: [] };
  const allCalls = (json.result ?? []).flatMap(b => b.calls ?? []);
  const c = allCalls[0];
  if (!c) return { success: 'unknown', assetChanges: empty, error: 'Empty simulation result' };

  const assetChanges = parseAssetChanges(allCalls, from, chainId, call.value);
  if (c.status !== '0x1') {
    return {
      success: false,
      revertReason: decodeRevert(c.returnData, c.error?.message) ?? 'Transaction would revert',
      assetChanges,
    };
  }
  return { success: true, assetChanges };
}

function normaliseValue(value?: string): string {
  return value && value !== '0x' ? value : '0x0';
}

async function handleSimError(
  json: SimV1Response, call: SimCallInput, chainId: number,
): Promise<SimulateResult> {
  const empty = { in: [], out: [] };
  const reason = await callForRevert(call, chainId);
  if (reason) return { success: false, revertReason: reason, assetChanges: empty };
  return { success: 'unknown', assetChanges: empty, error: json.error?.message ?? 'Simulation unavailable' };
}

async function simulateTx(p: SimulateParams): Promise<SimulateResult> {
  const empty = { in: [], out: [] };
  let from: string, to: string;
  try {
    from = getAddress(p.from);
    to = getAddress(p.to);
  } catch {
    return { success: 'unknown', assetChanges: empty, error: 'Invalid address' };
  }

  const valueHex = normaliseValue(p.value);
  const hasData = !!p.data && p.data !== '0x';
  if (!hasData) {
    const pre = await checkNativeBalance(from, valueHex, p.chainId);
    if (pre) return pre;
  }

  const call: SimCallInput = { from, to, value: valueHex, ...(hasData ? { data: p.data } : {}) };
  let json: SimV1Response;
  try {
    json = await runSimulateV1(call, p.chainId);
  } catch (e) {
    return {
      success: 'unknown', assetChanges: empty,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }

  if (json.error || !json.result) return handleSimError(json, call, p.chainId);
  return interpretSimResult(json, from, call, p.chainId);
}

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
