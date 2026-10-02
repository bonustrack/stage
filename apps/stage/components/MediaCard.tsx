import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box } from './layout';
import { usePalette } from '../lib/theme';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { mediaMaxWidth } from './bubble/imageBox.model';
import { bubbleLinkProps } from './bubble/linkProps';
import { openInBubbleLink } from '../lib/safeOpenLink';

interface Props {
  onPress?: () => void;
  url?: string;
  aspectRatio?: number;
  children: React.ReactNode;
}

export function MediaCard({ onPress, url, aspectRatio = 1, children }: Props): React.ReactElement {
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
  const press = url ? bubbleLinkProps(url, openInBubbleLink) : onPress ? { onPress } : null;
  return (
    <Box width="100%" maxWidth={mediaMaxWidth(aspectRatio)}>
      {press ? (
        <Pressable
          {...press}
          style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
        >
          {children}
        </Pressable>
      ) : <Box style={style}>{children}</Box>}
    </Box>
  );
}
