import { formatEther, formatUnits, type Hex } from 'viem';
import { getCurrentPrices, getPriceChanges, type UsdQuote } from '../api/defillama';
import { ETH_PRICE_ID, MULTICALL3, WALLET_ASSETS, erc20Abi, multicall3Abi, type Asset, type AssetRow } from './assets';
import { WALLET_CHAIN_ID } from './chains';
import { publicClientFor } from './client';

export interface WalletPortfolio {
  rows: AssetRow[];
  prices: Partial<Record<'ethereum' | 'bitcoin', UsdQuote>>;
}

export interface PortfolioRead extends WalletPortfolio {
  priceError: Error | undefined;
}

const BTC_PRICE_ID = 'bitcoin:btc';

export async function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  return (await fetchWalletPortfolio(addr)).rows;
}

function settledPrices(prices: Promise<Record<string, UsdQuote>>): Promise<{ quotes: Record<string, UsdQuote>; error?: Error }> {
  return prices.then(
    (quotes) => ({ quotes }),
    (error: unknown) => ({ quotes: {}, error: error instanceof Error ? error : new Error(String(error)) }),
  );
}

export async function fetchWalletPortfolio(addr: string): Promise<PortfolioRead> {
  const calls = WALLET_ASSETS.map((a) =>
    a.address === null
      ? { address: MULTICALL3, abi: multicall3Abi, functionName: 'getEthBalance' as const, args: [addr as Hex] }
      : { address: a.address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [addr as Hex] },
  );
  const balances = await publicClientFor(WALLET_CHAIN_ID).multicall({ contracts: calls, allowFailure: false });

  const ids = [...new Set([...WALLET_ASSETS.flatMap((a) => a.priceId ?? []), BTC_PRICE_ID])];
  const [current, changes] = await Promise.all([
    settledPrices(getCurrentPrices(ids)),
    getPriceChanges(ids).catch((): Record<string, number> => ({})),
  ]);
  const prices = current.quotes;
  return {
    rows: WALLET_ASSETS.map((a, i) => buildAssetRow(a, balances[i] ?? 0n, prices, changes)),
    prices: { ethereum: prices[ETH_PRICE_ID], bitcoin: prices[BTC_PRICE_ID] },
    priceError: current.error,
  };
}

function buildAssetRow(a: Asset, raw: bigint, prices: Record<string, UsdQuote>, changes: Record<string, number>): AssetRow {
  const balance = a.address === null ? formatEther(raw) : formatUnits(raw, a.decimals);
  const price = a.priceId === undefined ? undefined : prices[a.priceId];
  const change24h = a.priceId === undefined ? null : (changes[a.priceId] ?? null);
  return {
    symbol: a.symbol,
    name: a.name,
    chainId: a.chainId,
    balance,
    priceUsd: price?.usd ?? null,
    change24h,
    logoAddress: a.logoAddress,
  };
}
