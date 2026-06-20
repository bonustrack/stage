
import { View } from 'react-native';
import { Image } from './image';
import { AVATAR_SIZES, type AvatarSize } from './avatar';
import type { ImageStyle, StyleProp } from 'react-native';

export interface AvatarViewProps {
  src?: string | null;
  size?: AvatarSize | number;
  square?: boolean;
  alt?: string;
  placeholderColor?: string;
  style?: StyleProp<ImageStyle>;
}

export function AvatarView(props: AvatarViewProps): React.ReactElement {
  const { src, size = 'md', square, alt, placeholderColor = '#282a2d', style } = props;
  const px = typeof size === 'number' ? size : AVATAR_SIZES[size];
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
