import type { ViewStyle } from 'react-native';
import { Text } from '@stage-labs/kit/react-native/text';
import { Row } from '../layout';
import { unreadBadgeLabel } from '../../lib/format';
import { usePalette } from '../../lib/theme';

const UNREAD_BADGE_SIZE = 18;

export function UnreadBadgeLabel({ text, style }: { text: string; style?: ViewStyle }): React.ReactElement {
  const { link, bg } = usePalette();
  return (
    <Row
      minWidth={UNREAD_BADGE_SIZE}
      height={UNREAD_BADGE_SIZE}
      padding={{ x: 4 }}
      align="center"
      justify="center"
      radius="full"
      background={link}
      style={style}
    >
      <Text fontWeight="semibold" color={bg} size="3xs">
        {text}
      </Text>
    </Row>
  );
}

export function UnreadBadge({ count }: { count: number }): React.ReactElement {
  return <UnreadBadgeLabel text={unreadBadgeLabel(count) ?? ''} />;
}
