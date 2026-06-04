/** Wallet token-balance fetch — multicall per chain + CoinGecko prices.
 *  Extracted from WalletScreen for lint line-budget. Behaviour identical. */

import { createPublicClient, http, formatEther, formatUnits, type Hex } from 'viem';
import { getErc20UsdPrices, getSimplePrices } from '../../lib/coingecko';
import { stampTokenUrl, NATIVE_TOKEN_SENTINEL } from '@metro-labs/kit/avatar';
import {
  ASSETS, MULTICALL3, VIEM_CHAINS, erc20Abi, multicall3Abi, type AssetRow,
} from './WalletScreen.assets';

type Price = { usd: number; usd_24h_change?: number };

/** Fetch every asset's on-chain balance + USD price for `addr` and return the
 *  ready-to-render AssetRow[]. (Mention NATIVE_TOKEN_SENTINEL so the assets
 *  module import graph stays intact.) */
export async function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  void NATIVE_TOKEN_SENTINEL;
  /** Balances: one Multicall3 round-trip PER chain (brovider is multichain —
   *  the path segment is the chainId). Each chain batches ETH balance via
   *  getEthBalance + every ERC-20's balanceOf, and we run the chains in
   *  parallel. Returns a chainId → (per-asset raw balance) map. */
  const chainIds = [...new Set(ASSETS.map(a => a.chainId))];
  const balancesByChain = new Map<number, bigint[]>();
  await Promise.all(chainIds.map(async cid => {
    const chainAssets = ASSETS.filter(a => a.chainId === cid);
    const pub = createPublicClient({ chain: VIEM_CHAINS[cid]!, transport: http('https://rpc.brovider.xyz/' + cid) });
    const calls = chainAssets.map(a => a.address === null
      ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
      : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
    const results = await pub.multicall({ contracts: calls });
    balancesByChain.set(cid, results.map(r => r.status === 'success' ? r.result as bigint : 0n));
  }));

  /** Prices: simple-price once for ETH (same asset price on every chain),
   *  plus the contract endpoint per CoinGecko platform for the ERC-20s. */
  const platforms = [...new Set(ASSETS.filter(a => a.cgPlatform).map(a => a.cgPlatform!))];
  const cgIds = [...new Set(ASSETS.filter(a => a.cgId).map(a => a.cgId!))];
  const [simplePrices, ...platformPriceList] = await Promise.all([
    getSimplePrices(cgIds).catch(() => ({} as Record<string, Price>)),
    ...platforms.map(p => getErc20UsdPrices(p, ASSETS.filter(a => a.cgPlatform === p).map(a => (a.priceAddress ?? a.address!).toLowerCase()))
      .catch(() => ({} as Record<string, Price>))),
  ]);
  const tokenPricesByPlatform = new Map<string, Record<string, Price>>(
    platforms.map((p, i) => [p, platformPriceList[i]!]),
  );

  return ASSETS.map(a => {
    const idx = ASSETS.filter(x => x.chainId === a.chainId).indexOf(a);
    const raw = balancesByChain.get(a.chainId)?.[idx] ?? 0n;
    const balance = a.address === null
      ? formatEther(raw)
      : formatUnits(raw, a.decimals);
    const priceRec: Price | undefined = a.address === null
      ? (a.cgId ? simplePrices[a.cgId] : undefined)
      : (a.cgPlatform ? tokenPricesByPlatform.get(a.cgPlatform)?.[(a.priceAddress ?? a.address).toLowerCase()] : undefined);
    const priceUsd = priceRec?.usd ?? null;
    const change24h = typeof priceRec?.usd_24h_change === 'number' ? priceRec.usd_24h_change : null;
    return {
      symbol: a.symbol, name: a.name, chainId: a.chainId, balance, priceUsd, change24h,
      logoUrl: stampTokenUrl(a.chainId, a.logoAddress, 32),
    };
  });
}
