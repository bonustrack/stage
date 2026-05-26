/** Rounded, bordered "media bubble" wrapper. Used to give every shared
 *  attachment (image, video, map, YouTube thumbnail) a consistent frame so
 *  they feel like discrete cards rather than free-floating images. */

import { Pressable, View } from 'react-native';

interface Props {
  dark: boolean;
  /** Optional press handler — when set, the whole card is tappable. */
  onPress?: () => void;
  /** Card width hint. Defaults to a fluid `100% with max 280` so the card
   *  fits the bubble column without clipping but doesn't sprawl on tablet. */
  width?: number;
  children: React.ReactNode;
}

export function MediaCard({ dark, onPress, width, children }: Props): React.ReactElement {
  const border = dark ? '#262c38' : '#e3e7ef';
  const bg = dark ? '#0d1018' : '#f5f7fb';
  const style = {
    width: width ?? undefined,
    maxWidth: 280,
    borderRadius: 14,
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
  return <View style={style}>{children}</View>;
}
