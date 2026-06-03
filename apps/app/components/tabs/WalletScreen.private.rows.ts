/** Builds the Tokens-tab private (Railgun-shielded) rows in the public
 *  AssetRow shape so they render inline via the existing TokenRow, tagged
 *  `isPrivate` for the "Private" badge.
 *
 *  VISIBILITY CONTRACT: a FIXED set of private rows — ETH + USDC on each
 *  supported network (Ethereum + Sepolia) — ALWAYS renders, even at zero and
 *  even before any snapshot/scan exists. We seed the rows from the RAILGUN_TOKENS
 *  registry (the same source bridgeWallet.mapRows uses) so the icons/decimals
 *  match, then overlay live amounts from the snapshot when available. This is
 *  why opening the Tokens tab on a fresh wallet (nothing shielded yet) still
 *  shows the 4 Private rows instead of an empty list.
 *
 *  Shielded rows reuse the SAME unit price as their public twin (matched by
 *  symbol from the already-fetched public rows): private ETH shows the live ETH
 *  price, private USDC ≈ $1. Sepolia (testnet) rows intentionally reuse the
 *  mainnet symbol price too, so the $ column is never blank once shielded.
 *  Per-row USD value = balance × that unit price. Private rows are still
 *  EXCLUDED from the public wallet total (the total reduces over public rows
 *  only) — so this shows the value without double-counting. */

import type { AssetRow } from './WalletScreen.assets';
import type { PrivateSnapshot } from '../../lib/railgun/types';
import { RAILGUN_NETWORKS, type RailgunNet } from '../../lib/railgun/networks';
import { RAILGUN_TOKENS } from '../../lib/railgun/tokens';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

const NETS: readonly RailgunNet[] = ['mainnet', 'sepolia'];

/** Unit price (USD) + 24h change keyed by token symbol, derived from the
 *  already-fetched PUBLIC rows. Both networks share a symbol, so the latest
 *  non-null public price for ETH/USDC wins — letting Sepolia private rows reuse
 *  the mainnet unit price so the $ column stays populated. */
export type SymbolPrices = ReadonlyMap<string, { priceUsd: number | null; change24h: number | null }>;

/** Build the symbol→price map from the public AssetRow[] (the same rows the
 *  public Tokens list + wallet total use). Prefers the first non-null price
 *  seen for each symbol so a testnet/zero-priced twin can't clobber it. */
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

/** The always-present fixed private row set (ETH/USDC × mainnet/Sepolia) at
 *  zero balance, derived from the token registry so logos/decimals/network
 *  badges match the public rows. Used as the base before snapshot amounts land. */
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

/** Build the private Tokens rows. ALWAYS returns the fixed 4-row set; when a
 *  snapshot is present its amounts are merged in by (chainId, symbol). Zero
 *  balances are NOT filtered out — the rows are always visible. */
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
