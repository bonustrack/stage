import { formatEther, formatUnits, type Hex } from 'viem';
import { getCurrentPrices, getPriceChanges, type UsdQuote } from '../api/defillama';
import { ETH_PRICE_ID, MULTICALL3, WALLET_ASSETS, WALLET_CHAIN_ID, erc20Abi, multicall3Abi, type Asset, type AssetRow } from './assets';
import { publicClientFor } from './client';

export type TokenLogoResolver = (chainId: number, contract: string, displayPx: number) => string;

export interface FetchAssetRowsOptions {
  tokenLogo: TokenLogoResolver;
}

export interface WalletPortfolio {
  rows: AssetRow[];
  prices: Partial<Record<'ethereum' | 'bitcoin', UsdQuote>>;
}

const BTC_PRICE_ID = 'bitcoin:btc';

export async function fetchAssetRows(addr: string, opts: FetchAssetRowsOptions): Promise<AssetRow[]> {
  return (await fetchPortfolio(addr, opts, false)).rows;
}

export function fetchWalletPortfolio(addr: string, opts: FetchAssetRowsOptions, requirePrices = true): Promise<WalletPortfolio> {
  return fetchPortfolio(addr, opts, requirePrices);
}

async function fetchPortfolio(addr: string, opts: FetchAssetRowsOptions, requirePrices: boolean): Promise<WalletPortfolio> {
  const calls = WALLET_ASSETS.map(a => a.address === null
    ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
    : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] });
  const balances = await publicClientFor(WALLET_CHAIN_ID).multicall({ contracts: calls, allowFailure: false });

  const ids = [...new Set([...WALLET_ASSETS.flatMap(a => a.priceId ?? []), BTC_PRICE_ID])];
  const emptyPrices = (): Record<string, UsdQuote> => ({});
  const emptyChanges = (): Record<string, number> => ({});
  const currentPrices = getCurrentPrices(ids);
  const [prices, changes] = await Promise.all([
    requirePrices ? currentPrices : currentPrices.catch(emptyPrices),
    getPriceChanges(ids).catch(emptyChanges),
  ]);
  return {
    rows: WALLET_ASSETS.map((a, i) => buildAssetRow(a, balances[i] ?? 0n, prices, changes, opts.tokenLogo)),
    prices: { ethereum: prices[ETH_PRICE_ID], bitcoin: prices[BTC_PRICE_ID] },
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
  const price = a.priceId === undefined ? undefined : prices[a.priceId];
  const change24h = a.priceId === undefined ? null : changes[a.priceId] ?? null;
  return {
    symbol: a.symbol, name: a.name, chainId: a.chainId, balance,
    priceUsd: price?.usd ?? null, change24h,
    logoUrl: tokenLogo(a.chainId, a.logoAddress, 32),
  };
}
