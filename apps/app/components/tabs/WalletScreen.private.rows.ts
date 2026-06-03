/** Maps Railgun-shielded balances (PrivateBalance[]) into the public Tokens
 *  list's AssetRow shape so they render inline via the existing TokenRow,
 *  tagged `isPrivate` for the "Private" badge. Shielded rows carry no USD price
 *  (priceUsd/change24h null) — they're shown for their token amount only and
 *  are excluded from the public total. */

import type { AssetRow } from './WalletScreen.assets';
import type { PrivateBalance } from '../../lib/railgun/types';

export function privateBalancesToRows(balances: PrivateBalance[]): AssetRow[] {
  return balances
    // Only surface non-zero shielded balances in the merged list.
    .filter(b => Number(b.balance) > 0)
    .map(b => ({
      symbol: b.symbol,
      name: b.name,
      chainId: b.chainId,
      balance: b.balance,
      priceUsd: null,
      change24h: null,
      logoUrl: b.logoUrl,
      isPrivate: true,
    }));
}
