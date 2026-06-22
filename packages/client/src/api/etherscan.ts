
import { parseEtherscanResponse, type EtherscanResponse } from './etherscan.schema';
import type { EtherscanTx } from './etherscan.types';
import { readEnv } from './env';
export type { EtherscanTx } from './etherscan.types';

const DEFAULT_KEY =
  readEnv('EXPO_PUBLIC_ETHERSCAN_API_KEY') ?? '2UAJBTBZRQTSZUF9JW953W9XMGDM3YAZWY';

const V2_URL = 'https://api.etherscan.io/v2/api';

export const ACTIVITY_CHAINS = [
  { id: 1, label: 'Ethereum' },
  { id: 11155111, label: 'Sepolia' },
] as const;

export interface ActivityRow {
  hash: string;
  nonce: number;
  timestamp: number;
  direction: 'send' | 'receive' | 'self';
  isContract: boolean;
  counterparty: string;
  valueEth: string;
  failed: boolean;
  functionName: string;
  chainId: number;
  chainLabel: string;
}

export async function fetchActivity(
  address: string,
  chainId = 1,
  limit = 50,
  apiKey: string = DEFAULT_KEY,
): Promise<ActivityRow[]> {
  const addr = address.toLowerCase();
  const label = ACTIVITY_CHAINS.find(c => c.id === chainId)?.label ?? `chain ${chainId}`;
  const url =
    `${V2_URL}?chainid=${chainId}&module=account&action=txlist` +
    `&address=${addr}&startblock=0&endblock=99999999&page=1&offset=${limit}` +
    `&sort=desc&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`etherscan ${res.status}`);
  const json = parseEtherscanResponse(await res.json());
  const rows = resultRowsOrThrow(json);
  return rows.map(tx => mapTx(tx, addr, chainId, label));
}

function resultRowsOrThrow(json: EtherscanResponse): EtherscanTx[] {
  if (json.status !== '1' && !Array.isArray(json.result)) {
    const noTx = typeof json.result === 'string' && /no transactions/i.test(json.result);
    const noTxMsg = typeof json.result === 'string' && /no transactions/i.test(json.message);
    if (!noTx && !noTxMsg) {
      throw new Error(typeof json.result === 'string' ? json.result : json.message);
    }
  }
  return Array.isArray(json.result) ? json.result : [];
}

function mapTx(tx: EtherscanTx, addr: string, chainId: number, label: string): ActivityRow {
  const isOut = tx.from.toLowerCase() === addr;
  const isIn = tx.to.toLowerCase() === addr;
  const direction: ActivityRow['direction'] = isOut && isIn ? 'self' : isOut ? 'send' : 'receive';
  const isContract = !!tx.input && tx.input !== '0x' && tx.input !== '0x0';
  return {
    hash: tx.hash,
    nonce: Number(tx.nonce),
    timestamp: Number(tx.timeStamp),
    direction,
    isContract,
    counterparty: (isOut ? tx.to : tx.from).toLowerCase(),
    valueEth: weiToEth(tx.value),
    failed: tx.isError === '1',
    functionName: shortFn(tx.functionName ?? ''),
    chainId,
    chainLabel: label,
  };
}

export async function fetchActivityAllChains(
  address: string,
  limit = 50,
  apiKey: string = DEFAULT_KEY,
): Promise<ActivityRow[]> {
  const settled = await Promise.allSettled(
    ACTIVITY_CHAINS.map(c => fetchActivity(address, c.id, limit, apiKey)),
  );
  const ok = settled.filter(
    (r): r is PromiseFulfilledResult<ActivityRow[]> => r.status === 'fulfilled',
  );
  if (ok.length === 0) throw new Error('all chains failed');
  return ok
    .flatMap(r => r.value)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

function weiToEth(wei: string): string {
  let n = 0;
  try {
    n = Number(BigInt(wei || '0')) / 1e18;
  } catch {
    n = 0;
  }
  if (n === 0) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function shortFn(fn: string): string {
  if (!fn) return '';
  const i = fn.indexOf('(');
  return (i === -1 ? fn : fn.slice(0, i)).trim();
}
