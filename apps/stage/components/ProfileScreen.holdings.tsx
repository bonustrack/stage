import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from './Spinner';
import { Col, PAGE_GUTTER } from './layout';
import { DANGER, usePalette } from '../lib/theme';
import { useAssetRows } from './wallet/screen/data';
import { TokensList } from './wallet/screen/tokens';

function HoldingsBody({ address }: { address: string }): React.ReactElement {
  const { link: head, text: sub, bg, border } = usePalette();
  const { data: rows = null, isError: err } = useAssetRows(address);

  if (err) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Text size="md" color={DANGER}>
          Couldn’t load tokens
        </Text>
      </Col>
    );
  }
  if (rows === null) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Spinner size={28} color={head}/>
      </Col>
    );
  }
  if (rows.filter(r => Number(r.balance) > 0).length === 0) {
    return (
      <Col padding={{ y: 40 }} margin={{ x: PAGE_GUTTER }} align="center">
        <Text size="md" role="secondary">
          There are no tokens in this wallet.
        </Text>
      </Col>
    );
  }
  return <TokensList rows={rows} head={head} sub={sub} border={border} bg={bg} />;
}

export function ProfileHoldings({ address }: { address: string }): React.ReactElement {
  return (
    <Col margin={{ top: 16 }}>
      <HoldingsBody address={address} />
    </Col>
  );
}
