/** usePayerBalance — fetch the ACTIVE account's balance of the asset a payment
 *  request is asking for, on the request's chain. Native via `getBalance`,
 *  ERC-20 via `balanceOf`. One-shot on mount (no polling).
 *
 *  Resolution order:
 *   1. Registry-known asset on a known chain (VIEM_CHAINS + ASSETS) — uses the
 *      curated decimals/symbol and the wallet's brovider RPC.
 *   2. Generic on-chain fallback for UNKNOWN tokens/chains: a viem public client
 *      is built for any chainId (brovider RPC by chainId) and decimals/symbol are
 *      read straight off the ERC-20 (native falls back to ETH). This is what lets
 *      the card show "Balance: …" even when the asset/chain isn't in the registry.
 *
 *  Per-(chainId, token, account) cached so re-renders don't refetch. Any RPC /
 *  network error degrades gracefully (the row falls back to a subtle dash via the
 *  card) — it never throws. */
import { useEffect, useState } from 'react';
import { formatUnits, isAddress, erc20Abi, type Hex } from 'viem';

import { getActiveAccount } from '../lib/accounts';
import { ASSETS, NATIVE_TOKEN_SENTINEL } from '../components/tabs/WalletScreen.assets';
import { chainFor, publicClientFor } from '@stage-labs/client/wallet/client';
import { chainIdToNumber } from '@stage-labs/client/xmtp/tx';

export interface PayerBalance {
  /** Decimal-string balance (`formatUnits` output), display-trimmed. */
  text: string;
  /** True when the balance is below the requested amount. */
  insufficient: boolean;
}

/** Parse a request chainId (hex/decimal string or number), defaulting to
 *  mainnet when absent. Delegates the hex/decimal parse to the SDK. */
function parseChainId(raw?: string | number): number {
  return raw == null || raw === '' ? 1 : chainIdToNumber(raw);
}

/** Trim a formatted balance to at most 4 fraction digits without trailing zeros. */
function trim(value: string): string {
  if (!value.includes('.')) return value;
  const [whole, frac] = value.split('.');
  const cut = (frac ?? '').slice(0, 4).replace(/0+$/, '');
  return cut ? `${whole ?? ''}.${cut}` : (whole ?? '');
}

/** True for the native-coin sentinel / zero address (treated as native, not ERC-20). */
function isNativeToken(token?: string): boolean {
  if (!token) return true;
  const t = token.toLowerCase();
  return t === NATIVE_TOKEN_SENTINEL.toLowerCase()
    || t === '0x0000000000000000000000000000000000000000'
    || t === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
}

/** Resolved on-chain asset metadata (decimals + symbol) for an unknown ERC-20. */
interface OnchainMeta {
  raw: bigint;
  decimals: number;
  symbol: string;
}

/** Cache keyed by chainId:token:account so re-renders / re-mounts don't refetch.
 *  Stores the in-flight promise so concurrent cards dedupe too. */
const cache = new Map<string, Promise<OnchainMeta | null>>();

const minimalErc20Abi = [
  ...erc20Abi.filter(x => x.type === 'function' && (x.name === 'balanceOf' || x.name === 'decimals' || x.name === 'symbol')),
] as const;

/** One on-chain read of (balance, decimals, symbol) for a token (or native). */
async function readOnchain(
  cid: number, token: string | undefined, addr: Hex,
): Promise<OnchainMeta | null> {
  const chain = chainFor(cid);
  const pub = publicClientFor(cid);

  if (isNativeToken(token)) {
    const raw = await pub.getBalance({ address: addr });
    return { raw, decimals: chain.nativeCurrency.decimals, symbol: chain.nativeCurrency.symbol };
  }

  if (token === undefined || !isAddress(token)) return null;
  const t = token;
  // Balance is required; decimals/symbol are best-effort (some tokens omit them).
  const raw = await pub.readContract({
    address: t, abi: erc20Abi, functionName: 'balanceOf', args: [addr],
  });
  let decimals = 18;
  let symbol = 'tokens';
  try {
    decimals = await pub.readContract({ address: t, abi: minimalErc20Abi, functionName: 'decimals' });
  } catch { /* keep default 18 */ }
  try {
    symbol = await pub.readContract({ address: t, abi: minimalErc20Abi, functionName: 'symbol' });
  } catch { /* keep default 'tokens' */ }
  return { raw, decimals, symbol };
}

/** @param chainId   request chain (hex/dec string or number)
 *  @param token     ERC-20 contract address, or null/undefined/sentinel for native
 *  @param symbol    display symbol from the request (e.g. "USDC", "STAGE")
 *  @param needed    requested amount in whole units, used for the insufficient flag */
export function usePayerBalance(
  chainId: string | number | undefined,
  token: string | undefined,
  symbol: string | undefined,
  needed?: number,
): PayerBalance | null {
  const [bal, setBal] = useState<PayerBalance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cid = parseChainId(chainId);
        const acct = await getActiveAccount();
        const addr = acct?.address;
        if (!addr || !isAddress(addr)) return;

        const native = isNativeToken(token);
        // Prefer registry metadata (curated decimals/symbol) when the (chain,
        // symbol) pair is known — keeps display consistent with the wallet tab.
        const known = ASSETS.find(a => a.chainId === cid
          && a.symbol.toLowerCase() === (symbol ?? '').toLowerCase());

        const key = `${cid}:${(token ?? 'native').toLowerCase()}:${addr.toLowerCase()}`;
        let meta = cache.get(key);
        if (!meta) {
          meta = readOnchain(cid, token, addr).catch(() => null);
          cache.set(key, meta);
        }
        const onchain = await meta;
        if (cancelled) return;
        if (!onchain) {
          // Reading failed (unreachable RPC / unsupported chain) — drop the
          // cache entry so a later mount can retry, and leave the row hidden.
          cache.delete(key);
          return;
        }

        // Decimals/symbol: prefer the registry, then on-chain reads, then the
        // request-provided symbol, then sensible defaults.
        const decimals = known?.decimals ?? onchain.decimals;
        const human = formatUnits(onchain.raw, decimals);
        const sym = known?.symbol
          ?? symbol
          ?? (native ? onchain.symbol : (onchain.symbol === 'tokens' ? 'tokens' : onchain.symbol));

        setBal({
          text: `Balance: ${trim(human)} ${sym}`,
          insufficient: needed != null && Number(human) < needed,
        });
      } catch {
        // Defensive: never let the balance hook throw into the card.
      }
    })();
    return () => { cancelled = true; };
  }, [chainId, token, symbol, needed]);

  return bal;
}
