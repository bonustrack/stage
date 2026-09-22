
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from './layout';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';

interface Props {
  onPress?: () => void;
  width?: number;
  children: React.ReactNode;
}

export function MediaCard({ onPress, width, children }: Props): React.ReactElement {
  const border = usePalette().border;
  const bg = border;
  const style = {
    width: width ?? undefined,
    maxWidth: 280,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
    overflow: 'hidden' as const,
    marginBottom: 6,
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
