import { Col, PAGE_GUTTER } from '../../layout';
import { TokenRow } from './parts';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { tokenRowId } from '@stage-labs/client/wallet/tokens';


export function TokensList({
  rows, head, sub, border, bg,
}: {
  rows: AssetRow[];
  head: string;
  sub: string;
  border: string;
  bg: string;
}): React.ReactElement {
  return (
    <Col margin={{ x: PAGE_GUTTER }}>
      {rows.map(r => (
        <TokenRow
          key={tokenRowId(r)}
          r={r} head={head} sub={sub} border={border} bg={bg}
        />
      ))}
    </Col>
  );
}
