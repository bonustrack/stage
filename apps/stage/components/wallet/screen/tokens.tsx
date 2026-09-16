
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Col } from '../../layout';
import { TokenRow } from './parts';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { buildSortedTokenRows } from '@stage-labs/client/wallet/tokens';


export function TokensList({
  rows, head, sub, border, bg,
}: {
  rows: AssetRow[];
  head: string;
  sub: string;
  border: string;
  bg: string;
}): React.ReactElement {
  const router = useRouter();
  const sortedRows = useMemo(
    () => buildSortedTokenRows(rows).map(({ r, id }) => ({
      r,
      id,
      onPress: (): void => {
        router.push({
          pathname: '/wallet/token/[id]',
          params: { id, row: JSON.stringify(r) },
        });
      },
    })),
    [rows, router],
  );
  return (
    <Col margin={{ x: 16 }}>
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
