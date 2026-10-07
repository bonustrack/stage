import { Text } from '@stage-labs/kit/react-native/text';
import { Row } from './layout';
import { unreadBadgeLabel } from '../lib/format';
import { usePalette } from '../lib/theme';

const BADGE_SIZE = 18;

export function UnreadBadge({ count }: { count: number }): React.ReactElement {
  const { link, bg } = usePalette();
  return (
    <Row minWidth={BADGE_SIZE} height={BADGE_SIZE} padding={{ x: 4 }} align="center" justify="center" radius="full" background={link}>
      <Text weight="semibold" color={bg} size="3xs">{unreadBadgeLabel(count)}</Text>
    </Row>
  );
}
