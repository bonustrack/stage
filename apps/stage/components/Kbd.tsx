import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { usePalette } from '../lib/theme';

const KEY_SIZE = 20;

export function Kbd({ label }: { label: string }): React.ReactElement {
  const { sub } = usePalette();
  return (
    <Box
      surface="raised" radius="xs" align="center" justify="center"
      minWidth={KEY_SIZE} height={KEY_SIZE} padding={{ x: 4 }}
      style={{ borderWidth: 1, borderColor: sub }}
    >
      <Text size="2xs" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{label}</Text>
    </Box>
  );
}
