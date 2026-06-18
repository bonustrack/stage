/** Image - a ChatKit-styled image node. Mirrors ChatKit's `Image` widget; no
 *  `dark` deviation (fill/tint do not branch on scheme). Unifies the app's raw
 *  RN Image call sites behind one primitive so the RN-Image vs expo-image
 *  renderer can be swapped in ONE place later (switching the import below is the
 *  only change needed to migrate every call site). `fit` maps onto RN
 *  resizeMode. */

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
  /** ChatKit: src. The image URI (http(s)://, file://, ipfs://, data:). */
  src: string;
  /** ChatKit: alt. Accessibility label. */
  alt?: string;
  /** ChatKit: fit. Maps onto RN resizeMode. Default 'cover'. */
  fit?: ImageFit;
  /** ChatKit: position. Object-position hint (RN honours center/contain only;
   *  stored for parity + future expo-image objectPosition support). */
  position?: ImagePosition;
  /** ChatKit: frame. Draw a 1px hairline border around the image. */
  frame?: boolean;
  /** ChatKit: flush. Escape the container's horizontal padding (full-bleed).
   *  Pass the padding px (default 16 when true). */
  flush?: number | boolean;
  /** ChatKit: radius. Named scale ('sm'..'full') or raw px. */
  radius?: ImageRadius | number;
  /** ChatKit: size. Square shorthand for width + height. */
  size?: number | string;
  /** ChatKit: aspectRatio. width / height. */
  aspectRatio?: number;
  /** ChatKit: width. */
  width?: number | string;
  /** ChatKit: height. */
  height?: number | string;
  /** ChatKit: minWidth. */
  minWidth?: number | string;
  /** ChatKit: maxWidth. */
  maxWidth?: number | string;
  /** ChatKit: minHeight. */
  minHeight?: number | string;
  /** ChatKit: maxHeight. */
  maxHeight?: number | string;
  /** ChatKit: background. Placeholder fill shown behind/while loading. */
  background?: string;
  /** ChatKit: margin. Uniform px margin around the image box. */
  margin?: number;
  /** Escape-hatch style merged onto the image last. */
  style?: ImageStyle | ImageStyle[];
  /** Fires when the image finishes loading (RN Image onLoad passthrough). */
  onLoad?: (event: NativeSyntheticEvent<ImageLoadEventData>) => void;
  /** Fires when the image fails to load (RN Image onError passthrough). */
  onError?: () => void;
}

/** ChatKit-style RN image. */
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

/** Style-bag escape hatch for callers that need a plain box with the same
 *  radius scale (e.g. placeholder before src resolves). */
export function imageRadius(radius?: ImageRadius | number): ViewStyle {
  const r = radiusValue(radius) ?? BLOCK_RADIUS_DEFAULT;
  return { borderRadius: r };
}
