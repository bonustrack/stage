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
 *  Shielded rows carry no USD price (priceUsd/change24h null) — shown for their
 *  token amount only, excluded from the public total. */

import type { AssetRow } from './WalletScreen.assets';
import type { PrivateSnapshot } from '../../lib/railgun/types';
import { RAILGUN_NETWORKS, type RailgunNet } from '../../lib/railgun/networks';
import { RAILGUN_TOKENS } from '../../lib/railgun/tokens';
import { stampTokenUrl } from '@metro-labs/kit/avatar';

const NETS: readonly RailgunNet[] = ['mainnet', 'sepolia'];

/** The always-present fixed private row set (ETH/USDC × mainnet/Sepolia) at
 *  zero balance, derived from the token registry so logos/decimals/network
 *  badges match the public rows. Used as the base before snapshot amounts land. */
function fixedPrivateRows(): AssetRow[] {
  return NETS.flatMap((net) => {
    const chainId = RAILGUN_NETWORKS[net].chainId;
    return RAILGUN_TOKENS[net].map((t) => ({
      symbol: t.symbol,
      name: t.name,
      chainId,
      balance: '0',
      priceUsd: null,
      change24h: null,
      logoUrl: stampTokenUrl(t.logoChainId, t.logoAddress, 32),
      isPrivate: true,
    }));
  });
}

/** Build the private Tokens rows. ALWAYS returns the fixed 4-row set; when a
 *  snapshot is present its amounts are merged in by (chainId, symbol). Zero
 *  balances are NOT filtered out — the rows are always visible. */
export function privateBalancesToRows(snapshot: PrivateSnapshot | null): AssetRow[] {
  const base = fixedPrivateRows();
  if (!snapshot) return base;
  const byKey = new Map(snapshot.balances.map((b) => [`${b.chainId}:${b.symbol}`, b]));
  return base.map((row) => {
    const hit = byKey.get(`${row.chainId}:${row.symbol}`);
    return hit ? { ...row, balance: hit.balance, logoUrl: hit.logoUrl } : row;
  });
}
