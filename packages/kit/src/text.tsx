/** Text - ChatKit-styled body text. Hook-free: caller passes `dark` so colours
 *  track the palette convention in apps/app/lib/theme.ts (head / sub). Variants
 *  map onto Calibre families + palette colours:
 *    - body       head colour, Calibre-Regular (default)
 *    - secondary  sub colour
 *    - caption    sub colour, smaller
 *    - mono       head colour, monospace (addresses / hashes) */

import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';
export type TextWeight = 'regular' | 'medium' | 'semibold';
export type TextSizeToken = 'sm' | 'md' | 'lg';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  /** Numeric px or a token. Default depends on variant (caption→13, else 15). */
  size?: number | TextSizeToken;
  weight?: TextWeight;
  /** Override colour; wins over the variant/palette colour. */
  color?: string;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

const SIZE_TOKENS: Record<TextSizeToken, number> = { sm: 13, md: 15, lg: 17 };

const FONTS: Record<TextWeight, string> = {
  regular: 'Calibre-Regular',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
};

function resolveSize(size: number | TextSizeToken | undefined, variant: TextVariant): number {
  if (typeof size === 'number') return size;
  if (size) return SIZE_TOKENS[size];
  return variant === 'caption' ? 13 : 15;
}

function variantColor(variant: TextVariant, dark: boolean): string {
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  return variant === 'secondary' || variant === 'caption' ? sub : head;
}

/** ChatKit-style RN body text. */
export function Text(props: TextProps): React.ReactElement {
  const {
    variant = 'body',
    size,
    weight = 'regular',
    color,
    dark = false,
    style,
    children,
    ...rest
  } = props;

  const base: TextStyle = {
    color: color ?? variantColor(variant, dark),
    fontSize: resolveSize(size, variant),
    fontFamily: variant === 'mono' ? 'Menlo' : FONTS[weight],
  };

  return (
    <RNText style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base} {...rest}>
      {children}
    </RNText>
  );
}
