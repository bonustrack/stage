import { formatEther, formatUnits, type Hex } from 'viem';
import { getCurrentPrices, getPriceChanges, type UsdQuote } from '../api/defillama';
import { ASSETS, MULTICALL3, erc20Abi, multicall3Abi, type Asset, type AssetRow } from './assets';
import { publicClientFor } from './client';

export type TokenLogoResolver = (chainId: number, contract: string, displayPx: number) => string;

export interface FetchAssetRowsOptions {
  tokenLogo: TokenLogoResolver;
}

function assetPriceId(asset: Asset): string | null {
  if (asset.address === null) return asset.cgId ? `coingecko:${asset.cgId}` : null;
  return asset.cgPlatform ? `${asset.cgPlatform}:${(asset.priceAddress ?? asset.address).toLowerCase()}` : null;
}

export async function fetchAssetRows(addr: string, opts: FetchAssetRowsOptions): Promise<AssetRow[]> {
  const chainIds = [...new Set(ASSETS.map(a => a.chainId))];
  const balancesByChain = new Map<number, bigint[]>();
  await Promise.all(chainIds.map(async cid => {
    const chainAssets = ASSETS.filter(a => a.chainId === cid);
    const pub = publicClientFor(cid);
    const calls = chainAssets.map(a => a.address === null
      ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
      : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
    const results = await pub.multicall({ contracts: calls, allowFailure: false });
    balancesByChain.set(cid, results);
  }));

  const ids = [...new Set(ASSETS.map(assetPriceId).filter((id): id is string => id !== null))];
  const emptyChanges = (): Record<string, number> => ({});
  const [prices, changes] = await Promise.all([
    getCurrentPrices(ids),
    getPriceChanges(ids).catch(emptyChanges),
  ]);
  return ASSETS.map(a => buildAssetRow(a, balancesByChain, prices, changes, opts.tokenLogo));
}

function buildAssetRow(
  a: Asset,
  balancesByChain: Map<number, bigint[]>,
  prices: Record<string, UsdQuote>,
  changes: Record<string, number>,
  tokenLogo: TokenLogoResolver,
): AssetRow {
  const idx = ASSETS.filter(x => x.chainId === a.chainId).indexOf(a);
  const raw = balancesByChain.get(a.chainId)?.[idx] ?? 0n;
  const balance = a.address === null ? formatEther(raw) : formatUnits(raw, a.decimals);
  const priceId = assetPriceId(a);
  const price = priceId === null ? undefined : prices[priceId];
  const change24h = priceId === null ? null : changes[priceId] ?? null;
  return {
    symbol: a.symbol, name: a.name, chainId: a.chainId, balance,
    priceUsd: price?.usd ?? null, change24h,
    logoUrl: tokenLogo(a.chainId, a.logoAddress, 32),
  };
}
