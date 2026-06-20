/** @file Builds the always-present fixed set of private (Railgun-shielded) Tokens-tab rows in the public AssetRow shape, overlaying live snapshot amounts and reusing each token's public unit price by symbol. */

import type { AssetRow } from './WalletScreen.assets';
import type { PrivateSnapshot } from '../../lib/railgun/types';
import { RAILGUN_NETWORKS, type RailgunNet } from '../../lib/railgun/networks';
import { RAILGUN_TOKENS } from '../../lib/railgun/tokens';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

const NETS: readonly RailgunNet[] = ['mainnet', 'sepolia'];

/** Unit price (USD) + 24h change keyed by token symbol from the already-fetched public rows; the first non-null price per symbol wins so Sepolia private rows reuse the mainnet price and the $ column stays populated. */
export type SymbolPrices = ReadonlyMap<string, { priceUsd: number | null; change24h: number | null }>;

/** Build the symbol→price map from the public AssetRow[] (the same rows the public Tokens list + wallet total use). Prefers the first non-null price seen for each symbol so a testnet/zero-priced twin can't clobber it. */
export function symbolPricesFromPublic(publicRows: readonly AssetRow[]): SymbolPrices {
  const map = new Map<string, { priceUsd: number | null; change24h: number | null }>();
  for (const r of publicRows) {
    const prev = map.get(r.symbol);
    if (!prev || (prev.priceUsd === null && r.priceUsd !== null)) {
      map.set(r.symbol, { priceUsd: r.priceUsd, change24h: r.change24h });
    }
  }
  return map;
}

/** The always-present fixed private row set (ETH/USDC × mainnet/Sepolia) at zero balance, derived from the token registry so logos/decimals/network badges match the public rows. Used as the base before snapshot amounts land. */
function fixedPrivateRows(prices: SymbolPrices): AssetRow[] {
  return NETS.flatMap((net) => {
    const chainId = RAILGUN_NETWORKS[net].chainId;
    return RAILGUN_TOKENS[net].map((t) => {
      const price = prices.get(t.symbol);
      return {
        symbol: t.symbol,
        name: t.name,
        chainId,
        balance: '0',
        priceUsd: price?.priceUsd ?? null,
        change24h: price?.change24h ?? null,
        logoUrl: stampTokenUrl(t.logoChainId, t.logoAddress, 32),
        isPrivate: true,
      };
    });
  });
}

/** Build the private Tokens rows. ALWAYS returns the fixed 4-row set; when a snapshot is present its amounts are merged in by (chainId, symbol). Zero balances are NOT filtered out — the rows are always visible. */
export function privateBalancesToRows(
  snapshot: PrivateSnapshot | null,
  prices: SymbolPrices = new Map(),
): AssetRow[] {
  const base = fixedPrivateRows(prices);
  if (!snapshot) return base;
  const byKey = new Map(snapshot.balances.map((b) => [`${b.chainId}:${b.symbol}`, b]));
  return base.map((row) => {
    const hit = byKey.get(`${row.chainId}:${row.symbol}`);
    return hit ? { ...row, balance: hit.balance, logoUrl: hit.logoUrl } : row;
  });
}
