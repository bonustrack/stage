import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from './layout';
import { TEXT_12PX } from './smallText';

const KEY_SIZE = 20;

export function Kbd({ label }: { label: string }): React.ReactElement {
  return (
    <Box
      surface="surface" radius="xs" align="center" justify="center"
      minWidth={KEY_SIZE} height={KEY_SIZE} padding={{ x: 4 }}
    >
      <Text numberOfLines={1} style={[TEXT_12PX, { fontVariant: ['tabular-nums'] }]}>{label}</Text>
    </Box>
  );
}
