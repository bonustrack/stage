/** Wallet token-balance fetch — Multicall3 per chain + CoinGecko prices, shaped
 *  into ready-to-render AssetRow[]. Framework-agnostic (viem + fetch only).
 *
 *  Moved out of apps/app's WalletScreen.data for the Stage SDK. The token-logo
 *  URL is INJECTED (the app passes kit's stampTokenUrl) so packages/client stays
 *  free of any @metro-labs/kit dependency. */

import { createPublicClient, http, formatEther, formatUnits, type Hex } from 'viem';
import { getErc20UsdPrices, getSimplePrices } from '../api/coingecko';
import {
  ASSETS, MULTICALL3, VIEM_CHAINS, erc20Abi, multicall3Abi, type AssetRow,
} from './assets';

type Price = { usd: number; usd_24h_change?: number };

/** Build a token-logo URL for `(chainId, contract)` at a display size. The app
 *  supplies kit's stampTokenUrl; a default identicon-less stub keeps the SDK
 *  usable without it. */
export type TokenLogoResolver = (chainId: number, contract: string, displayPx: number) => string;

export interface FetchAssetRowsOptions {
  /** Resolve the per-row token logo URL. */
  tokenLogo: TokenLogoResolver;
  /** Optional CoinGecko key override (defaults to the shared read key). */
  coingeckoKey?: string;
}

/** Fetch every asset's on-chain balance + USD price for `addr` and return the
 *  ready-to-render AssetRow[]. */
export async function fetchAssetRows(
  addr: string,
  opts: FetchAssetRowsOptions,
): Promise<AssetRow[]> {
  const { tokenLogo, coingeckoKey } = opts;

  /** Balances: one Multicall3 round-trip PER chain (brovider is multichain — the
   *  path segment is the chainId). Each chain batches the native ETH balance via
   *  getEthBalance + every ERC-20's balanceOf, run in parallel. */
  const chainIds = [...new Set(ASSETS.map(a => a.chainId))];
  const balancesByChain = new Map<number, bigint[]>();
  await Promise.all(chainIds.map(async cid => {
    const chainAssets = ASSETS.filter(a => a.chainId === cid);
    const pub = createPublicClient({
      chain: VIEM_CHAINS[cid]!,
      transport: http('https://rpc.brovider.xyz/' + cid),
    });
    const calls = chainAssets.map(a => a.address === null
      ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
      : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
    const results = await pub.multicall({ contracts: calls });
    balancesByChain.set(cid, results.map(r => (r.status === 'success' ? r.result as bigint : 0n)));
  }));

  /** Prices: simple-price once for ETH (same price on every chain), plus the
   *  contract endpoint per CoinGecko platform for the ERC-20s. */
  const platforms = [...new Set(ASSETS.filter(a => a.cgPlatform).map(a => a.cgPlatform!))];
  const cgIds = [...new Set(ASSETS.filter(a => a.cgId).map(a => a.cgId!))];
  const [simplePrices, ...platformPriceList] = await Promise.all([
    getSimplePrices(cgIds, coingeckoKey).catch(() => ({} as Record<string, Price>)),
    ...platforms.map(p =>
      getErc20UsdPrices(p, ASSETS.filter(a => a.cgPlatform === p).map(a => (a.priceAddress ?? a.address!).toLowerCase()), coingeckoKey)
        .catch(() => ({} as Record<string, Price>))),
  ]);
  const tokenPricesByPlatform = new Map<string, Record<string, Price>>(
    platforms.map((p, i) => [p, platformPriceList[i]!]),
  );

  return ASSETS.map(a => {
    const idx = ASSETS.filter(x => x.chainId === a.chainId).indexOf(a);
    const raw = balancesByChain.get(a.chainId)?.[idx] ?? 0n;
    const balance = a.address === null ? formatEther(raw) : formatUnits(raw, a.decimals);
    const priceRec: Price | undefined = a.address === null
      ? (a.cgId ? simplePrices[a.cgId] : undefined)
      : (a.cgPlatform ? tokenPricesByPlatform.get(a.cgPlatform)?.[(a.priceAddress ?? a.address).toLowerCase()] : undefined);
    const priceUsd = priceRec?.usd ?? null;
    const change24h = typeof priceRec?.usd_24h_change === 'number' ? priceRec.usd_24h_change : null;
    return {
      symbol: a.symbol, name: a.name, chainId: a.chainId, balance, priceUsd, change24h,
      logoUrl: tokenLogo(a.chainId, a.logoAddress, 32),
    };
  });
}
