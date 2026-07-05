
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Col } from '../layout';
import { TokenRow } from './WalletScreen.parts';
import { PendingShieldRows } from './WalletScreen.pending';
import type { AssetRow } from './WalletScreen.assets';
import type { PendingAction } from '../../lib/railgun/types';
import { buildSortedTokenRows } from './WalletScreen.sort';

export { buildSortedTokenRows, tokenRowId } from './WalletScreen.sort';

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
