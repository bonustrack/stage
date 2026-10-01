import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from './layout';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { mediaMaxWidth } from './bubble/imageBox.model';

interface Props {
  onPress?: () => void;
  aspectRatio?: number;
  children: React.ReactNode;
}

export function MediaCard({ onPress, aspectRatio = 1, children }: Props): React.ReactElement {
  const { border, bg } = usePalette();
  const style = {
    width: '100%' as const,
    aspectRatio,
    borderRadius: BLOCK_RADIUS_DEFAULT,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: bg,
    overflow: 'hidden' as const,
  };
  return (
    <Box width="100%" maxWidth={mediaMaxWidth(aspectRatio)}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
        >
          {children}
        </Pressable>
      ) : <Box style={style}>{children}</Box>}
    </Box>
  );
}
