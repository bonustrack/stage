import { formatEther, formatUnits, type Hex } from 'viem';
import { getCurrentPrices, getPriceChanges, type UsdQuote } from '../api/defillama';
import { MULTICALL3, WALLET_ASSETS, WALLET_CHAIN_ID, erc20Abi, multicall3Abi, type Asset, type AssetRow } from './assets';
import { publicClientFor } from './client';

export type TokenLogoResolver = (chainId: number, contract: string, displayPx: number) => string;

export interface FetchAssetRowsOptions {
  tokenLogo: TokenLogoResolver;
}

export interface WalletPortfolio {
  rows: AssetRow[];
  prices: Partial<Record<'ethereum' | 'bitcoin', UsdQuote>>;
}

function assetPriceId(asset: Asset): string | null {
  if (asset.address === null) return asset.cgId ? `coingecko:${asset.cgId}` : null;
  return asset.cgPlatform ? `${asset.cgPlatform}:${(asset.priceAddress ?? asset.address).toLowerCase()}` : null;
}

export async function fetchAssetRows(addr: string, opts: FetchAssetRowsOptions): Promise<AssetRow[]> {
  return (await fetchPortfolio(addr, opts, false)).rows;
}

export function fetchWalletPortfolio(addr: string, opts: FetchAssetRowsOptions): Promise<WalletPortfolio> {
  return fetchPortfolio(addr, opts, true);
}

async function fetchPortfolio(addr: string, opts: FetchAssetRowsOptions, requirePrices: boolean): Promise<WalletPortfolio> {
  const calls = WALLET_ASSETS.map(a => a.address === null
    ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
    : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
  const balances = await publicClientFor(WALLET_CHAIN_ID).multicall({ contracts: calls, allowFailure: false });

  const ids = [...new Set([...WALLET_ASSETS.map(assetPriceId).filter((id): id is string => id !== null), 'coingecko:bitcoin'])];
  const emptyPrices = (): Record<string, UsdQuote> => ({});
  const emptyChanges = (): Record<string, number> => ({});
  const currentPrices = getCurrentPrices(ids);
  const [prices, changes] = await Promise.all([
    requirePrices ? currentPrices : currentPrices.catch(emptyPrices),
    getPriceChanges(ids).catch(emptyChanges),
  ]);
  return {
    rows: WALLET_ASSETS.map((a, i) => buildAssetRow(a, balances[i] ?? 0n, prices, changes, opts.tokenLogo)),
    prices: { ethereum: prices['coingecko:ethereum'], bitcoin: prices['coingecko:bitcoin'] },
  };
}

function buildAssetRow(
  a: Asset,
  raw: bigint,
  prices: Record<string, UsdQuote>,
  changes: Record<string, number>,
  tokenLogo: TokenLogoResolver,
): AssetRow {
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
