import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { changeColor } from '../../lib/uiColors';
import type { TokenRowFields } from './screen/model';
import { Column, Row } from '../layout';

export interface TokenRowViewParams extends TokenRowFields {
  chainBadgeUri?: string;
}

export function TokenRowBody(params: TokenRowViewParams): React.ReactElement {
  const scheme = useKitScheme();
  const color = changeColor(params.change)[scheme];
  return (
    <Row align="center" gap={12} weight={1}>
      {params.chainBadgeUri === undefined ? null : (
        <Column>
          <Image fit="cover" url={params.logoUri} size={40} radius="full" />
          <Image fit="cover" url={params.chainBadgeUri} size={16} radius="full" />
        </Column>
      )}
      <Column gap={2}>
        <Text text={params.title} fontWeight="semibold" size="md" truncate />
        <Text text={params.subtitle} color="secondary" size="xs" />
      </Column>
      <Column weight={1} />
      <Column gap={2} align="end">
        {params.amount === '' ? null : <Text text={params.amount} fontWeight="semibold" size="md" textAlign="end" />}
        <Row gap={4} justify="end" align="center">
          <Text text={params.detail} color="secondary" size="xs" />
          {params.change === '' ? null : <Text text={params.change} color={color} size="xs" />}
        </Row>
      </Column>
    </Row>
  );
}
