import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { changeColor } from '../../lib/uiColors';
import type { TokenRowFields } from './token.model';
import { Column, Row } from '../layout';

export function TokenRowBody({ avatar, ...row }: TokenRowFields & { avatar?: React.ReactNode }): React.ReactElement {
  const scheme = useKitScheme();
  const color = changeColor(row.change)[scheme];
  return (
    <Row align="center" gap={12} weight={1}>
      {avatar}
      <Column gap={2}>
        <Text text={row.title} fontWeight="semibold" size="md" truncate />
        <Text text={row.subtitle} color="secondary" size="xs" />
      </Column>
      <Column weight={1} />
      <Column gap={2} align="end">
        {row.amount === '' ? null : <Text text={row.amount} fontWeight="semibold" size="md" textAlign="end" />}
        <Row gap={4} justify="end" align="center">
          <Text text={row.detail} color="secondary" size="xs" />
          {row.change === '' ? null : <Text text={row.change} color={color} size="xs" />}
        </Row>
      </Column>
    </Row>
  );
}
