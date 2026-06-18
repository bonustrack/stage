/** The merged public + shielded token list for the Wallet Tokens tab.
 *
 *  Public and shielded (Private-badged) rows are merged into ONE flat list then
 *  sorted by USD value (priceUsd × balance) DESCENDING, so the highest-value
 *  holdings sit at the top. A high-value private token can outrank a low-value
 *  public one — the list is ranked purely by $. Rows with no price / zero
 *  balance compute usdValue 0 and sink to the bottom; `.sort` is stable
 *  (V8/Hermes) so among equal-value rows the original public-then-private order
 *  is preserved. Pending shield rows render above the sorted list.
 *
 *  Only positive-balance rows are shown: zero-balance public and shielded rows
 *  (including the always-seeded fixed private set) are filtered out so the wallet
 *  page lists only tokens the user actually holds. */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Col } from '../layout';
import { TokenRow } from './WalletScreen.parts';
import { PendingShieldRows } from './WalletScreen.pending';
import type { AssetRow } from './WalletScreen.assets';
import type { PendingAction } from '../../lib/railgun/types';

export function TokensList({
  rows, privateRows, pending, head, sub, border, bg,
}: {
  rows: AssetRow[];
  privateRows: AssetRow[];
  pending: PendingAction[];
  head: string;
  sub: string;
  border: string;
  bg: string;
}): React.ReactElement {
  const router = useRouter();
  // Merge public + shielded rows, drop zero-balance, then rank by USD value
  // DESC. Memoized on the row arrays so this O(n log n) filter/map/sort chain
  // only re-runs when the underlying data changes — not on every parent
  // re-render (frequent: Railgun snapshot updates, balance refetches, tab
  // switches). `.sort` stays stable (V8/Hermes) so equal-value ordering is
  // preserved, matching the documented behavior exactly.
  const sortedRows = useMemo(
    () => [...rows, ...privateRows]
      .filter(r => Number(r.balance) > 0)
      .map(r => ({ r, usdValue: (r.priceUsd ?? 0) * Number(r.balance) }))
      .sort((a, b) => b.usdValue - a.usdValue)
      .map(({ r }) => r),
    [rows, privateRows],
  );
  return (
    <Col margin={{ x: 16 }}>
      <PendingShieldRows pending={pending} pal={{ head, sub, border }} />
      {sortedRows
        .map(r => {
          const id = `${r.isPrivate ? 'priv' : 'pub'}:${r.chainId}:${r.symbol}`;
          return (
            <TokenRow
              key={id}
              r={r} head={head} sub={sub} border={border} bg={bg}
              onPress={() => router.push({
                pathname: '/wallet/token/[id]',
                params: { id, row: JSON.stringify(r) },
              })}
            />
          );
        })}
    </Col>
  );
}
