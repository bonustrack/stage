import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';

const KEY_SIZE = 20;

export function Kbd({ label }: { label: string }): React.ReactElement {
  return (
    <Box
      surface="surface" radius="xs" align="center" justify="center"
      minWidth={KEY_SIZE} height={KEY_SIZE} padding={{ x: 4 }}
    >
      <Text size="3xs" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{label}</Text>
    </Box>
  );
}
