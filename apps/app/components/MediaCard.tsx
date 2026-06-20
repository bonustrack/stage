/** @file Rounded, bordered "media bubble" wrapper giving every shared attachment (image, video, map, YouTube thumbnail) a consistent card-like frame. */

import { Pressable } from '@stage-labs/kit/pressable';
import { Box } from './layout';
import { usePalette, useBlockRadius } from '../lib/theme';

interface Props {
  dark: boolean;
  /** Optional press handler — when set, the whole card is tappable. */
  onPress?: () => void;
  /** Card width hint. Defaults to a fluid `100% with max 280` so the card fits the bubble column without clipping but doesn't sprawl on tablet. */
  width?: number;
  children: React.ReactNode;
}

/** Renders a rounded, bordered frame wrapping a shared media attachment. */
export function MediaCard({ onPress, width, children }: Props): React.ReactElement {
  /** Theme border color (#282a2d dark / #e4e4e5 light). */
  const border = usePalette().border;
  const bg = border;
  const blockRadius = useBlockRadius();
  const style = {
    width: width ?? undefined,
    maxWidth: 280,
    borderRadius: blockRadius,
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
