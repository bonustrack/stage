/** Etherscan v2 tx-history helper — mirrors the API-key convention used by
 *  coingecko.ts / opensea.ts (reuse Snapshot UI's read key; overridable via
 *  EXPO_PUBLIC_ETHERSCAN_API_KEY). Etherscan v1 is deprecated in 2026 — this
 *  uses the unified v2 endpoint (`/v2/api?chainid=<id>&...`).
 *
 *  Returns the account's normal transactions sorted newest-first (sort=desc),
 *  which for a single EOA corresponds to NONCE DESCENDING. */

const ETHERSCAN_API_KEY =
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
  value: string;        // wei
  isError: string;      // "0" ok, "1" failed
  functionName?: string;
  input: string;        // "0x" = plain transfer
  gasUsed: string;
  gasPrice: string;
}

/** Normalised row the Activity tab renders. */
export interface ActivityRow {
  hash: string;
  nonce: number;
  timestamp: number;          // unix seconds
  direction: 'send' | 'receive' | 'self';
  /** True when this is a contract interaction (non-empty calldata). */
  isContract: boolean;
  counterparty: string;       // the other party's address (lowercased)
  valueEth: string;           // decimal ETH string
  failed: boolean;
  functionName: string;       // decoded method name, or '' for plain transfer
}

/** Fetch up to `limit` normal transactions for `address` on `chainId`,
 *  newest-first (nonce desc for an EOA). Throws on a transport/API error so
 *  the caller can render an error state; an address with no history resolves
 *  to an empty array (Etherscan returns status "0" / "No transactions found"). */
export async function fetchActivity(
  address: string, chainId = 1, limit = 50,
): Promise<ActivityRow[]> {
  const addr = address.toLowerCase();
  const url = `${V2_URL}?chainid=${chainId}&module=account&action=txlist`
    + `&address=${addr}&startblock=0&endblock=99999999&page=1&offset=${limit}`
    + `&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`etherscan ${res.status}`);
  const json = await res.json() as { status: string; message: string; result: EtherscanTx[] | string };
  // status "0" with message "No transactions found" + array result = empty (not an error).
  if (json.status !== '1') {
    if (Array.isArray(json.result) && json.result.length === 0) return [];
    if (typeof json.result === 'string' && /no transactions/i.test(json.result)) return [];
    if (typeof json.result === 'string' && /no transactions/i.test(json.message)) return [];
    // Anything else (rate limit, invalid key) is a real error.
    if (!Array.isArray(json.result)) throw new Error(typeof json.result === 'string' ? json.result : json.message);
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
    };
  });
}

/** wei (decimal string) → trimmed ETH decimal string. Avoids viem to keep this
 *  helper dependency-light; precision to 6 dp is plenty for a row. */
function weiToEth(wei: string): string {
  let n = 0;
  try { n = Number(BigInt(wei || '0')) / 1e18; } catch { n = 0; }
  if (n === 0) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** "transfer(address,uint256)" → "transfer". Empty for plain ETH sends. */
function shortFn(fn: string): string {
  if (!fn) return '';
  const i = fn.indexOf('(');
  return (i === -1 ? fn : fn.slice(0, i)).trim();
}
