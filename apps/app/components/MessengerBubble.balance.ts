/** usePayerBalance — fetch the ACTIVE account's balance of the asset a payment
 *  request is asking for, on the request's chain. Native ETH via `getBalance`,
 *  ERC-20 via `balanceOf`. One-shot on mount (no polling). Reuses the same viem
 *  plumbing as the Wallet tab (VIEM_CHAINS + brovider RPC). */
import { useEffect, useState } from 'react';
import { createPublicClient, http, formatUnits, isAddress, erc20Abi, type Hex } from 'viem';

import { getActiveAccount } from '../lib/accounts';
import { ASSETS, VIEM_CHAINS } from '../components/tabs/WalletScreen.assets';

export interface PayerBalance {
  /** Decimal-string balance (`formatUnits` output), display-trimmed. */
  text: string;
  /** True when the balance is below the requested amount. */
  insufficient: boolean;
}

/** Parse a request chainId that may be a hex string ("0xaa36a7"), a decimal
 *  string, or already a number. Defaults to mainnet. */
function parseChainId(raw?: string | number): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 1;
  return raw.startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 10);
}

/** Trim a formatted balance to at most 4 fraction digits without trailing zeros. */
function trim(value: string): string {
  if (!value.includes('.')) return value;
  const [whole, frac] = value.split('.');
  const cut = frac.slice(0, 4).replace(/0+$/, '');
  return cut ? `${whole}.${cut}` : whole;
}

/** @param chainId   request chain (hex/dec string or number)
 *  @param token     ERC-20 contract address, or null/undefined for native ETH
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
        const chain = VIEM_CHAINS[cid];
        if (!chain) return;
        const acct = await getActiveAccount();
        const addr = acct?.address;
        if (!addr || !isAddress(addr)) return;

        const isErc20 = !!token && isAddress(token);
        // Decimals: trust the asset registry for the (chain, symbol) pair, else 18.
        const known = ASSETS.find(a => a.chainId === cid
          && a.symbol.toLowerCase() === (symbol ?? '').toLowerCase());
        const decimals = known?.decimals ?? (isErc20 ? 18 : 18);

        const pub = createPublicClient({ chain, transport: http('https://rpc.brovider.xyz/' + cid) });
        const raw = isErc20
          ? await pub.readContract({
              address: token as Hex, abi: erc20Abi, functionName: 'balanceOf', args: [addr as Hex],
            }) as bigint
          : await pub.getBalance({ address: addr as Hex });

        if (cancelled) return;
        const human = formatUnits(raw, decimals);
        const sym = symbol ?? (isErc20 ? 'tokens' : 'ETH');
        setBal({
          text: `Balance: ${trim(human)} ${sym}`,
          insufficient: needed != null && Number(human) < needed,
        });
      } catch {
        // Network/RPC errors leave the line hidden — it's a nice-to-have.
      }
    })();
    return () => { cancelled = true; };
  }, [chainId, token, symbol, needed]);

  return bal;
}
