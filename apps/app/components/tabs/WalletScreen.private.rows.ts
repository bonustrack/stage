
import type { AssetRow } from './WalletScreen.assets';
import type { PrivateSnapshot } from '../../lib/railgun/types';
import { RAILGUN_NETWORKS, type RailgunNet } from '../../lib/railgun/networks';
import { RAILGUN_TOKENS } from '../../lib/railgun/tokens';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

const NETS: readonly RailgunNet[] = ['mainnet', 'sepolia'];

export type SymbolPrices = ReadonlyMap<string, { priceUsd: number | null; change24h: number | null }>;

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
