/**
 * @file React Native avatar renderer: draws an already-resolved image src (or a placeholder) at a fixed square frame and radius, leaving URL resolution to the app.
 */

import { View } from 'react-native';
import { Image } from './image';
import { AVATAR_SIZES, type AvatarSize } from './avatar';
import type { ImageStyle, StyleProp } from 'react-native';

export interface AvatarViewProps {
  /** Already-resolved image URI. When absent, a placeholder circle is drawn. */
  src?: string | null;
  /** Canonical preset (`sm`/`md`/`lg`) or an explicit pixel size. */
  size?: AvatarSize | number;
  /** Rounded SQUARE instead of a circle (groups/channels vs users). */
  square?: boolean;
  /** Accessibility label for the image. */
  alt?: string;
  /** Placeholder fill colour (shown when there is no `src`). */
  placeholderColor?: string;
  /** Extra style overrides (ring, background, etc.). */
  style?: StyleProp<ImageStyle>;
}

/** Kit RN avatar renderer (image or placeholder, correctly sized + shaped). */
export function AvatarView(props: AvatarViewProps): React.ReactElement {
  const { src, size = 'md', square, alt, placeholderColor = '#282a2d', style } = props;
  const px = typeof size === 'number' ? size : AVATAR_SIZES[size];
  /** Circle (users) vs rounded square (groups/channels); radius scales with px so the corner rounding looks consistent across sm/md/lg. */
  const baseStyle: StyleProp<ImageStyle> = {
    width: px,
    height: px,
    borderRadius: square ? Math.round(px * 0.12) : 999,
    backgroundColor: placeholderColor,
  };

  if (src?.trim()) {
    return <Image src={src} alt={alt} style={[baseStyle, style] as ImageStyle[]} />;
  }
  return <View style={[baseStyle, style]} />;
}
