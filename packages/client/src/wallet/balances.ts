/** @file Framework-agnostic wallet token-balance fetcher (viem + fetch only): Multicall3 reads per chain plus CoinGecko prices shaped into ready-to-render AssetRow[], with the token-logo URL injected so packages/client stays free of any @stage-labs/kit dependency. */

import { formatEther, formatUnits, type Hex } from 'viem';
import { getErc20UsdPrices, getSimplePrices } from '../api/coingecko';
import {
  ASSETS, MULTICALL3, erc20Abi, multicall3Abi, type AssetRow,
} from './assets';
import { publicClientFor } from './client';

interface Price { usd: number; usd_24h_change?: number }

/** Build a token-logo URL for `(chainId, contract)` at a display size. The app supplies kit's stampTokenUrl; a default identicon-less stub keeps the SDK usable without it. */
export type TokenLogoResolver = (chainId: number, contract: string, displayPx: number) => string;

export interface FetchAssetRowsOptions {
  /** Resolve the per-row token logo URL. */
  tokenLogo: TokenLogoResolver;
  /** Optional CoinGecko key override (defaults to the shared read key). */
  coingeckoKey?: string;
}

/** Fetch every asset's on-chain balance + USD price for `addr` and return the ready-to-render AssetRow[]. */
export async function fetchAssetRows(
  addr: string,
  opts: FetchAssetRowsOptions,
): Promise<AssetRow[]> {
  const { tokenLogo, coingeckoKey } = opts;

  /** Balances: one Multicall3 round-trip PER chain (brovider is multichain — the path segment is the chainId). Each chain batches the native ETH balance via getEthBalance + every ERC-20's balanceOf, run in parallel. */
  const chainIds = [...new Set(ASSETS.map(a => a.chainId))];
  const balancesByChain = new Map<number, bigint[]>();
  await Promise.all(chainIds.map(async cid => {
    const chainAssets = ASSETS.filter(a => a.chainId === cid);
    const pub = publicClientFor(cid);
    const calls = chainAssets.map(a => a.address === null
      ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
      : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
    const results = await pub.multicall({ contracts: calls });
    balancesByChain.set(cid, results.map(r => (r.status === 'success' ? r.result : 0n)));
  }));

  /** Prices: simple-price once for ETH (same price on every chain), plus the contract endpoint per CoinGecko platform for the ERC-20s. */
  const emptyPrices = (): Record<string, Price> => ({});
  const platforms = [
    ...new Set(
      ASSETS.map(a => a.cgPlatform).filter((p): p is string => typeof p === 'string'),
    ),
  ];
  const cgIds = [
    ...new Set(ASSETS.map(a => a.cgId).filter((id): id is string => typeof id === 'string')),
  ];
  const [simplePrices, ...platformPriceList] = await Promise.all([
    getSimplePrices(cgIds, coingeckoKey).catch(emptyPrices),
    ...platforms.map(p =>
      getErc20UsdPrices(
        p,
        ASSETS.filter(a => a.cgPlatform === p).map(a =>
          (a.priceAddress ?? a.address ?? '').toLowerCase(),
        ),
        coingeckoKey,
      ).catch(emptyPrices)),
  ]);
  const tokenPricesByPlatform = new Map<string, Record<string, Price>>(
    platforms.map((p, i) => [p, platformPriceList[i] ?? {}]),
  );

  return ASSETS.map(a =>
    buildAssetRow(a, balancesByChain, simplePrices, tokenPricesByPlatform, tokenLogo));
}

/** Resolve the CoinGecko price record for one asset (native → simple-price by cgId; ERC-20 → contract price by platform+address). */
function priceFor(
  a: (typeof ASSETS)[number],
  simplePrices: Record<string, Price>,
  tokenPricesByPlatform: Map<string, Record<string, Price>>,
): Price | undefined {
  if (a.address === null) return a.cgId ? simplePrices[a.cgId] : undefined;
  if (!a.cgPlatform) return undefined;
  return tokenPricesByPlatform.get(a.cgPlatform)?.[(a.priceAddress ?? a.address).toLowerCase()];
}

/** Shape one asset's on-chain balance + USD price into a ready-to-render AssetRow. */
function buildAssetRow(
  a: (typeof ASSETS)[number],
  balancesByChain: Map<number, bigint[]>,
  simplePrices: Record<string, Price>,
  tokenPricesByPlatform: Map<string, Record<string, Price>>,
  tokenLogo: TokenLogoResolver,
): AssetRow {
  const idx = ASSETS.filter(x => x.chainId === a.chainId).indexOf(a);
  const raw = balancesByChain.get(a.chainId)?.[idx] ?? 0n;
  const balance = a.address === null ? formatEther(raw) : formatUnits(raw, a.decimals);
  const priceRec = priceFor(a, simplePrices, tokenPricesByPlatform);
  const priceUsd = priceRec?.usd ?? null;
  const change24h = typeof priceRec?.usd_24h_change === 'number' ? priceRec.usd_24h_change : null;
  return {
    symbol: a.symbol, name: a.name, chainId: a.chainId, balance, priceUsd, change24h,
    logoUrl: tokenLogo(a.chainId, a.logoAddress, 32),
  };
}
