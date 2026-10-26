import {
  Image as RNImage,
  StyleSheet,
  View,
  type DimensionValue,
  type ImageLoadEventData,
  type ImageProps as RNImageProps,
  type ImageStyle,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { flushBleed } from '../layout';
import type { RadiusValue } from '../radius';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';

export type ImageFit = 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown';
export type ImageVariant = 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
export type ImagePosition =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top left' | 'top right' | 'bottom left' | 'bottom right';
export type ImageRadius = RadiusValue;

declare module 'react-native' {
  interface ImagePropsAndroid {
    resizeMultiplier?: number;
  }
}

export type ImageResizeMethod = NonNullable<RNImageProps['resizeMethod']>;

const FIT: Record<ImageFit, ImageStyle['resizeMode']> = {
  none: 'center',
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  scaleDown: 'contain',
};

const RADIUS: Record<ImageRadius, number> = {
  none: 0, '2xs': 2, xs: 4, sm: 6, md: 8, lg: 12,
  xl: 16, '2xl': 20, '3xl': 24, '4xl': 28, full: 999, '100%': 999,
};

const FULL_ROUND = 999;

const VARIANT_BOX: Record<ImageVariant, ImageStyle> = {
  icon: { width: 24, height: 24 },
  avatar: { width: 40, height: 40, borderRadius: FULL_ROUND },
  smallFeature: { width: 100, height: 100 },
  mediumFeature: { width: '100%', maxWidth: 300, aspectRatio: 4 / 3 },
  largeFeature: { width: '100%', maxHeight: 400, aspectRatio: 16 / 9 },
  header: { width: '100%', height: 200 },
};

function radiusValue(radius?: ImageRadius | number): number | undefined {
  if (radius === undefined) return undefined;
  return typeof radius === 'number' ? radius : RADIUS[radius];
}

export interface ImageProps extends A2uiCommonProps {
  url: string;
  headers?: Record<string, string>;
  description?: string;
  fit?: ImageFit;
  variant?: ImageVariant;
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
  style?: StyleProp<ImageStyle>;
  resizeMethod?: ImageResizeMethod;
  resizeMultiplier?: number;
  onLoad?: (event: NativeSyntheticEvent<ImageLoadEventData>) => void;
  onError?: () => void;
}

function dimension(value: number | string | undefined): DimensionValue | undefined {
  return value as DimensionValue | undefined;
}

function defined(style: ImageStyle): ImageStyle {
  return Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined));
}

function explicitBox(props: ImageProps): ImageStyle {
  const { size, width, height, minWidth, maxWidth, minHeight, maxHeight, aspectRatio, radius, background, margin, flush, frame } = props;
  const bleed = flushBleed(flush);
  const box: ImageStyle = defined({
    width: dimension(size ?? width),
    height: dimension(size ?? height),
    minWidth: dimension(minWidth),
    maxWidth: dimension(maxWidth),
    minHeight: dimension(minHeight),
    maxHeight: dimension(maxHeight),
    aspectRatio,
    borderRadius: radiusValue(radius),
    backgroundColor: background,
    margin,
    marginHorizontal: bleed ? -bleed : undefined,
  });
  if (frame) {
    box.borderWidth = 1;
    box.borderColor = '#e4e4e5';
  }
  return box;
}

function imageBox(props: ImageProps): ImageStyle {
  const variant = props.variant === undefined ? {} : VARIANT_BOX[props.variant];
  return { ...variant, ...explicitBox(props), ...(props.weight === undefined ? {} : { flex: props.weight }) };
}

export function Image(props: ImageProps): React.ReactElement {
  const { url, headers, description, fit = 'fill', style, resizeMethod, resizeMultiplier, onLoad, onError, accessibility } = props;
  const base = imageBox(props);
  const flattened = style === undefined ? base : StyleSheet.flatten([base, style]);
  if (url.trim() === '') {
    return <View style={flattened} {...accessibilityProps(accessibility)} />;
  }
  return (
    <RNImage
      source={headers ? { uri: url, headers } : { uri: url }}
      resizeMode={FIT[fit]}
      resizeMethod={resizeMethod}
      resizeMultiplier={resizeMultiplier}
      accessibilityLabel={description}
      accessible={description !== undefined}
      {...accessibilityProps(accessibility)}
      style={flattened}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export function getImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(url, (width, height) => { resolve({ width, height }); }, reject);
  });
}

export function imageRadius(radius?: ImageRadius | number): ViewStyle {
  const r = radiusValue(radius) ?? BLOCK_RADIUS_DEFAULT;
  return { borderRadius: r };
}
