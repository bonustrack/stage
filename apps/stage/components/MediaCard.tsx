import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from './layout';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';

interface Props {
  onPress?: () => void;
  children: React.ReactNode;
}

export function MediaCard({ onPress, children }: Props): React.ReactElement {
  const { border, bg } = usePalette();
  const style = {
    width: '100%' as const,
    aspectRatio: 1,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
    overflow: 'hidden' as const,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <Box style={style}>{children}</Box>;
}
