/** Etherscan v2 tx-history helper. Mirrors the API-key convention used by
 *  coingecko.ts / opensea.ts (reuse Snapshot UI's read key; overridable via
 *  EXPO_PUBLIC_ETHERSCAN_API_KEY, or the `apiKey` arg the Stage client
 *  threads through). Etherscan v1 is deprecated in 2026, so this uses the
 *  unified v2 endpoint (`/v2/api?chainid=<id>&...`).
 *
 *  Returns the account's normal transactions sorted newest-first (sort=desc),
 *  which for a single EOA corresponds to NONCE DESCENDING. Pure `fetch`. */

import { parseEtherscanResponse } from './etherscan.schema';

const DEFAULT_KEY =
  process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY ?? '2UAJBTBZRQTSZUF9JW953W9XMGDM3YAZWY';

const V2_URL = 'https://api.etherscan.io/v2/api';

/** Raw Etherscan `txlist` row (subset we render). All numeric fields arrive
 *  as decimal strings. */
export interface EtherscanTx {
  hash: string;
  nonce: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string; // wei
  isError: string; // "0" ok, "1" failed
  functionName?: string;
  input: string; // "0x" = plain transfer
  gasUsed: string;
  gasPrice: string;
}

/** Chains the Activity tab fetches, newest-first across all of them. */
export const ACTIVITY_CHAINS = [
  { id: 1, label: 'Ethereum' },
  { id: 11155111, label: 'Sepolia' },
] as const;

/** Normalised row the Activity tab renders. */
export interface ActivityRow {
  hash: string;
  nonce: number;
  timestamp: number; // unix seconds
  direction: 'send' | 'receive' | 'self';
  /** True when this is a contract interaction (non-empty calldata). */
  isContract: boolean;
  counterparty: string; // the other party's address (lowercased)
  valueEth: string; // decimal ETH string
  failed: boolean;
  functionName: string; // decoded method name, or '' for plain transfer
  chainId: number; // source chain (1 mainnet, 11155111 Sepolia)
  chainLabel: string; // human label for the per-row badge
}

/** Fetch up to `limit` normal transactions for `address` on `chainId`,
 *  newest-first (nonce desc for an EOA). Throws on a transport/API error so
 *  the caller can render an error state; an address with no history resolves
 *  to an empty array (Etherscan returns status "0" / "No transactions found"). */
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
  // Boundary: validate the response envelope so a drifted/garbage body throws
  // loudly with a logged reason instead of being cast into a wrong shape.
  const json = parseEtherscanResponse(await res.json());
  // status "0" with message "No transactions found" + array result = empty (not an error).
  if (json.status !== '1') {
    if (Array.isArray(json.result) && json.result.length === 0) return [];
    if (typeof json.result === 'string' && /no transactions/i.test(json.result)) return [];
    if (typeof json.result === 'string' && /no transactions/i.test(json.message)) return [];
    // Anything else (rate limit, invalid key) is a real error.
    if (!Array.isArray(json.result))
      throw new Error(typeof json.result === 'string' ? json.result : json.message);
  }
  const rows = Array.isArray(json.result) ? json.result : [];
  return rows.map(tx => {
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
  });
}

/** Fetch activity across ALL ACTIVITY_CHAINS in parallel, merged newest-first.
 *  Each chain's errors are isolated, so a failed/empty chain is skipped while
 *  the other still renders. Rejects only if EVERY chain throws (so the caller
 *  can show an error state); an all-empty result resolves to []. */
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

/** wei (decimal string) -> trimmed ETH decimal string. Avoids viem to keep this
 *  helper dependency-light; precision to 6 dp is plenty for a row. */
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

/** "transfer(address,uint256)" -> "transfer". Empty for plain ETH sends. */
function shortFn(fn: string): string {
  if (!fn) return '';
  const i = fn.indexOf('(');
  return (i === -1 ? fn : fn.slice(0, i)).trim();
}
