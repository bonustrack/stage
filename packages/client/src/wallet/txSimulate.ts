import { ASSETS, NATIVE_TOKEN_SENTINEL } from './assets';
import { decodeAbiParameters, type Hex } from 'viem';

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
  return { symbol: `${addr.slice(0, 6)}…${addr.slice(-4)}`, decimals: 18 };
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
