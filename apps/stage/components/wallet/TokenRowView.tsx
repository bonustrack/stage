import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { changeColor } from '../../lib/uiColors';
import { Column, Row } from '../layout';

export interface TokenRowViewParams {
  symbol: string;
  name: string;
  priceUsd: string;
  balance: string;
  change24h: string;
  logoUri: string;
  chainBadgeUri?: string;
}

export function TokenRowBody(params: TokenRowViewParams): React.ReactElement {
  const scheme = useKitScheme();
  const color = changeColor(params.change24h)[scheme];
  return (
    <Row align="center" gap={12} weight={1}>
      {params.chainBadgeUri === undefined ? null : (
        <Column>
          <Image fit="cover" url={params.logoUri} size={40} radius="full" />
          <Image fit="cover" url={params.chainBadgeUri} size={16} radius="full" />
        </Column>
      )}
      <Column gap={2}>
        <Text text={params.symbol} fontWeight="semibold" size="md" truncate />
        <Text text={params.name} color="secondary" size="xs" />
      </Column>
      <Column weight={1} />
      <Column gap={2} align="end">
        {params.balance === '' ? null : <Text text={params.balance} fontWeight="semibold" size="md" textAlign="end" />}
        <Row gap={4} justify="end" align="center">
          <Text text={params.priceUsd} color="secondary" size="xs" />
          {params.change24h === '' ? null : <Text text={params.change24h} color={color} size="xs" />}
        </Row>
      </Column>
    </Row>
  );
}
