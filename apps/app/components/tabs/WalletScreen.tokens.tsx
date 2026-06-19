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
import { buildSortedTokenRows } from './WalletScreen.sort';

// Pure merge/filter/sort/id transform lives in WalletScreen.sort (JSX-free, so
// it's unit-testable). Re-exported here so existing import sites stay stable.
export { buildSortedTokenRows, tokenRowId } from './WalletScreen.sort';

/** Renders the wallet's public and private token holdings with pending actions. */
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
  // Each entry carries a STABLE per-row id + onPress closure so the memoized
  // TokenRow can skip re-rendering when the parent re-renders for unrelated
  // reasons. Folding id/onPress into this memo (keyed on the data + router)
  // keeps the closures referentially stable across renders — an inline
  // `() => router.push(...)` per `.map()` would be a fresh function each render
  // and defeat TokenRow's memo entirely.
  const sortedRows = useMemo(
    () => buildSortedTokenRows(rows, privateRows).map(({ r, id }) => ({
      r,
      id,
      onPress: (): void => {
        router.push({
          pathname: '/wallet/token/[id]',
          params: { id, row: JSON.stringify(r) },
        });
      },
    })),
    [rows, privateRows, router],
  );
  return (
    <Col margin={{ x: 16 }}>
      <PendingShieldRows pending={pending} pal={{ head, sub, border }} />
      {sortedRows
        .map(({ r, id, onPress }) => (
          <TokenRow
            key={id}
            r={r} head={head} sub={sub} border={border} bg={bg}
            onPress={onPress}
          />
        ))}
    </Col>
  );
}
