
import { useMemo } from 'react';
import { Col, PAGE_GUTTER } from '../../layout';
import { TokenRow } from './parts';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { buildSortedTokenRows } from '@stage-labs/client/wallet/tokens';


export function TokensList({
  rows, head, sub, border, bg, nativeChainIds,
}: {
  rows: AssetRow[];
  head: string;
  sub: string;
  border: string;
  bg: string;
  nativeChainIds?: readonly number[];
}): React.ReactElement {
  const sortedRows = useMemo(
    () => buildSortedTokenRows(rows, nativeChainIds),
    [rows, nativeChainIds],
  );
  return (
    <Col margin={{ x: PAGE_GUTTER }}>
      {sortedRows
        .map(({ r, id }) => (
          <TokenRow
            key={id}
            r={r} head={head} sub={sub} border={border} bg={bg}
          />
        ))}
    </Col>
  );
}
