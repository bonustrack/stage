
import {
  Image as RNImage,
  type ImageStyle,
  type ViewStyle,
  type DimensionValue,
  type ImageLoadEventData,
  type NativeSyntheticEvent,
} from 'react-native';
import { BLOCK_RADIUS_DEFAULT } from './tokens';

export type ImageFit = 'none' | 'cover' | 'contain' | 'fill' | 'scale-down';
export type ImagePosition =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top left' | 'top right' | 'bottom left' | 'bottom right';
export type ImageRadius =
  | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  | 'full' | '100%' | 'none';

const FIT: Record<ImageFit, ImageStyle['resizeMode']> = {
  none: 'center',
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  'scale-down': 'contain',
};

const RADIUS: Record<ImageRadius, number> = {
  none: 0, '2xs': 2, xs: 4, sm: 6, md: 8, lg: 12,
  xl: 16, '2xl': 20, '3xl': 24, '4xl': 28, full: 999, '100%': 999,
};

function radiusValue(radius?: ImageRadius | number): number | undefined {
  if (radius === undefined) return undefined;
  return typeof radius === 'number' ? radius : RADIUS[radius];
}

export interface ImageProps {
  src: string;
  alt?: string;
  fit?: ImageFit;
  position?: ImagePosition;
  frame?: boolean;
  flush?: number | boolean;
  radius?: ImageRadius | number;
  size?: number | string;
  aspectRatio?: number;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  background?: string;
  margin?: number;
  style?: ImageStyle | ImageStyle[];
  onLoad?: (event: NativeSyntheticEvent<ImageLoadEventData>) => void;
  onError?: () => void;
}

export function Image(props: ImageProps): React.ReactElement {
  const {
    src, alt, fit = 'cover', frame, flush, radius, size, aspectRatio,
    width, height, minWidth, maxWidth, minHeight, maxHeight,
    background, margin, style, onLoad, onError,
  } = props;

  const bleed = flush === true ? 16 : typeof flush === 'number' ? flush : 0;
  const r = radiusValue(radius);

  const base: ImageStyle = {
    width: (size ?? width) as DimensionValue | undefined,
    height: (size ?? height) as DimensionValue | undefined,
    minWidth: minWidth as DimensionValue | undefined,
    maxWidth: maxWidth as DimensionValue | undefined,
    minHeight: minHeight as DimensionValue | undefined,
    maxHeight: maxHeight as DimensionValue | undefined,
    aspectRatio,
    borderRadius: r,
    backgroundColor: background,
    margin,
    marginHorizontal: bleed ? -bleed : undefined,
  };

  if (frame) {
    base.borderWidth = 1;
    base.borderColor = '#e4e4e5';
  }

  const flattened = style ? ([base, style].flat()) : base;

  return (
    <RNImage
      source={{ uri: src }}
      resizeMode={FIT[fit]}
      accessibilityLabel={alt}
      accessible={alt !== undefined}
      style={flattened}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export function imageRadius(radius?: ImageRadius | number): ViewStyle {
  const r = radiusValue(radius) ?? BLOCK_RADIUS_DEFAULT;
  return { borderRadius: r };
}
