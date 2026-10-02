import { ASSETS, NATIVE_TOKEN_SENTINEL } from './assets';
import { shortAddress } from '../identity/format';
import { decodeAbiParameters, getAddress, type Hex } from 'viem';
import { broviderRpc } from './client';

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface AssetMove {
  token: string;
  symbol: string;
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

export function decodeRevert(returnData?: string, errMsg?: string): string | undefined {
  const d = returnData && returnData !== '0x' ? returnData : undefined;
  if (d?.startsWith('0x08c379a0')) {
    try {
      const [msg] = decodeAbiParameters([{ type: 'string' }], ('0x' + d.slice(10)) as Hex);
      if (msg) return humanizeRevert(msg);
    } catch { }
  }
  if (d?.startsWith('0x4e487b71')) return 'Execution panic (assert/overflow)';
  if (errMsg) return humanizeRevert(errMsg);
  return undefined;
}

function tokenMeta(addr: string, chainId: number): { symbol: string; decimals: number } {
  const lc = addr.toLowerCase();
  const hit = ASSETS.find(a => a.chainId === chainId && a.address?.toLowerCase() === lc);
  if (hit) return { symbol: hit.symbol, decimals: hit.decimals };
  return { symbol: shortAddress(addr), decimals: 18 };
}

function nativeMeta(chainId: number): { symbol: string; decimals: number } {
  const hit = ASSETS.find(a => a.chainId === chainId && a.address === null);
  return { symbol: hit?.symbol ?? 'ETH', decimals: hit?.decimals ?? 18 };
}

export function formatAmount(raw: bigint, decimals: number): string {
  if (raw < 0n) raw = -raw;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return whole.toString();
  let fs = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (fs.length > 6) fs = fs.slice(0, 6);
  return `${whole.toString()}.${fs}`;
}

export function insufficientEthReason(balanceWei: bigint, valueWei: bigint, chainId: number): string {
  const { symbol, decimals } = nativeMeta(chainId);
  return `insufficient ${symbol} (have ${formatAmount(balanceWei, decimals)}, need ${formatAmount(valueWei, decimals)})`;
}

function topicToAddr(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase();
}

function emitterKey(address?: string): string {
  const emitter = (address ?? '').toLowerCase();
  const isNative =
    emitter === '' ||
    emitter === '0x0000000000000000000000000000000000000000' ||
    emitter === NATIVE_TOKEN_SENTINEL.toLowerCase();
  return isNative ? '' : emitter;
}

interface ParsedTransfer { key: string; amount: bigint; fromA: string; toA: string }

function transferTopics(log: SimLog): [string, string] | null {
  const topics = log.topics;
  if (!topics?.length || topics[0]?.toLowerCase() !== TRANSFER_TOPIC || topics.length < 3) return null;
  const topic1 = topics[1];
  const topic2 = topics[2];
  if (topic1 === undefined || topic2 === undefined) return null;
  return [topic1, topic2];
}

function parseTransferLog(log: SimLog): ParsedTransfer | null {
  const topics = transferTopics(log);
  if (!topics) return null;
  let amount: bigint;
  try { amount = BigInt(log.data && log.data !== '0x' ? log.data : '0x0'); }
  catch { return null; }
  if (amount === 0n) return null;
  return { key: emitterKey(log.address), amount, fromA: topicToAddr(topics[0]), toA: topicToAddr(topics[1]) };
}

function netTransfers(calls: SimCall[], me: string): Map<string, bigint> {
  const net = new Map<string, bigint>();
  const add = (token: string, delta: bigint): void => {
    net.set(token, (net.get(token) ?? 0n) + delta);
  };
  for (const c of calls) {
    for (const log of c.logs ?? []) {
      const t = parseTransferLog(log);
      if (!t) continue;
      if (t.toA === me) add(t.key, t.amount);
      if (t.fromA === me) add(t.key, -t.amount);
    }
  }
  return net;
}

function buildMove(key: string, delta: bigint, chainId: number): AssetMove {
  const meta = key === '' ? nativeMeta(chainId) : tokenMeta(key, chainId);
  return {
    token: key === '' ? NATIVE_TOKEN_SENTINEL : key,
    symbol: meta.symbol,
    decimals: meta.decimals,
    amount: formatAmount(delta, meta.decimals),
  };
}

export function parseAssetChanges(
  calls: SimCall[],
  from: string,
  chainId: number,
  topValue?: string,
): { in: AssetMove[]; out: AssetMove[] } {
  const me = from.toLowerCase();
  const net = netTransfers(calls, me);

  if (topValue) {
    try {
      const v = BigInt(topValue);
      if (v > 0n && (net.get('') ?? 0n) === 0n) net.set('', -v);
    } catch { }
  }

  const out: AssetMove[] = [];
  const incoming: AssetMove[] = [];
  for (const [key, delta] of net) {
    if (delta === 0n) continue;
    const move = buildMove(key, delta, chainId);
    if (delta < 0n) out.push(move); else incoming.push(move);
  }
  return { in: incoming, out };
}

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

export async function simulateTx(p: SimulateParams): Promise<SimulateResult> {
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
