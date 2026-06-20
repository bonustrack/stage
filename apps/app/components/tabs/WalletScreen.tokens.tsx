/** @file Wallet Tokens tab list: merges public + shielded rows into one list sorted by USD value descending, filtering out zero-balance rows and rendering pending shield rows on top. */

import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Col } from '../layout';
import { TokenRow } from './WalletScreen.parts';
import { PendingShieldRows } from './WalletScreen.pending';
import type { AssetRow } from './WalletScreen.assets';
import type { PendingAction } from '../../lib/railgun/types';
import { buildSortedTokenRows } from './WalletScreen.sort';

/** The pure merge/filter/sort/id transform lives in JSX-free WalletScreen.sort (unit-testable); re-exported here so existing import sites stay stable. */
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
  /** Memoized merge/filter (drop zero-balance) and stable USD-DESC sort, with each entry carrying a stable per-row id + onPress closure so the O(n log n) work and memoized TokenRow only re-run/re-render when the underlying data or router changes. */
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
