/** Text - an OpenAI ChatKit-API RN text component. Hook-free: caller passes
 *  `dark` so colours track the palette convention in apps/app/lib/theme.ts
 *  (head / sub).
 *
 *  CANONICAL API (mirrors ChatKit's Text widget / BaseTextProps 1:1):
 *    value          string (or `children`)
 *    size           xs|sm|md|lg|xl  (ChatKit TextSize) - or a numeric px
 *    weight         normal|medium|semibold|bold
 *    color          override colour
 *    textAlign      start|center|end
 *    italic, lineThrough, truncate, maxLines
 *
 *  BACK-COMPAT ALIASES (deprecated, kept so existing apps/app call sites work):
 *    variant="body|secondary|caption|mono"  legacy colour/role form, mapped
 *    weight="regular"   -> normal
 *    size="sm|md|lg"    legacy 3-token scale (sm=13, md=15, lg=17) still honoured */

import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

/** @deprecated Legacy role-name `variant`. Mapped onto colour + font family. */
export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

/** ChatKit font weight, plus the legacy `regular` alias of `normal`. */
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

/** ChatKit TextSize scale. Legacy `sm|md|lg` overlap and keep their px values. */
export type TextSizeToken = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** ChatKit text alignment. */
export type TextAlign = 'start' | 'center' | 'end';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** ChatKit `value`. Ignored if `children` is provided. */
  value?: string;
  /** @deprecated Legacy role variant (body/secondary/caption/mono). */
  variant?: TextVariant;
  /** ChatKit TextSize token (xs..xl) or a numeric px. Default 15 (md), or 13
   *  when the legacy `caption` variant is used. */
  size?: number | TextSizeToken;
  /** ChatKit font weight. `regular` is a deprecated alias of `normal`. */
  weight?: TextWeight;
  /** Override colour; wins over the variant/palette colour. */
  color?: string;
  /** ChatKit `textAlign` (start/center/end). */
  textAlign?: TextAlign;
  /** ChatKit `italic`. */
  italic?: boolean;
  /** ChatKit `lineThrough`. */
  lineThrough?: boolean;
  /** ChatKit `truncate`: single-line ellipsis. */
  truncate?: boolean;
  /** ChatKit `maxLines`: clamp to N lines. */
  maxLines?: number;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

/** ChatKit TextSize px values; legacy sm/md/lg keep their original px. */
const SIZE_TOKENS: Record<TextSizeToken, number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
};

const FONTS: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: 'Calibre-Regular',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  // Only Calibre-Medium/Semibold are loaded; map ChatKit `bold` to Semibold.
  bold: 'Calibre-Semibold',
};

function normalizeWeight(w: TextWeight): keyof typeof FONTS {
  return w === 'regular' ? 'normal' : w;
}

function resolveSize(
  size: number | TextSizeToken | undefined,
  variant: TextVariant,
): number {
  if (typeof size === 'number') return size;
  if (size) return SIZE_TOKENS[size];
  return variant === 'caption' ? 13 : 15;
}

function variantColor(variant: TextVariant, dark: boolean): string {
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  return variant === 'secondary' || variant === 'caption' ? sub : head;
}

const ALIGN_MAP: Record<TextAlign, TextStyle['textAlign']> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

/** OpenAI ChatKit-API RN text. */
export function Text(props: TextProps): React.ReactElement {
  const {
    value,
    variant = 'body',
    size,
    weight = 'normal',
    color,
    textAlign,
    italic = false,
    lineThrough = false,
    truncate = false,
    maxLines,
    dark = false,
    style,
    children,
    ...rest
  } = props;

  const base: TextStyle = {
    color: color ?? variantColor(variant, dark),
    fontSize: resolveSize(size, variant),
    fontFamily: variant === 'mono' ? 'Menlo' : FONTS[normalizeWeight(weight)],
  };
  if (textAlign) base.textAlign = ALIGN_MAP[textAlign];
  if (italic) base.fontStyle = 'italic';
  if (lineThrough) base.textDecorationLine = 'line-through';

  const clamp = truncate ? 1 : maxLines;
  const content = children ?? value;

  return (
    <RNText
      style={style ? [base, ...(Array.isArray(style) ? style : [style])] : base}
      numberOfLines={clamp}
      {...rest}
    >
      {content}
    </RNText>
  );
}
