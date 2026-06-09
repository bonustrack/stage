/** Text - an OpenAI ChatKit-API RN text component. Hook-free: caller passes
 *  `dark` so colours track the palette convention in apps/app/lib/theme.ts
 *  (head / sub).
 *
 *  CANONICAL API (mirrors ChatKit's Text widget / BaseTextProps 1:1):
 *    value          string (or `children`)
 *    size           3xs..6xl  (named t-shirt step from the kit FONT_SIZE scale)
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
import { FONT_SIZE, type FontSizeName, resolveColorToken, type ColorToken } from './tokens';

/** @deprecated Legacy role-name `variant`. Mapped onto colour + font family. */
export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

/** ChatKit font weight, plus the legacy `regular` alias of `normal`. */
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

/** Named TextSize scale (3xs..6xl). Single source of truth in tokens.ts. */
export type TextSizeToken = FontSizeName;

/** ChatKit text alignment. */
export type TextAlign = 'start' | 'center' | 'end';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** ChatKit `value`. Ignored if `children` is provided. */
  value?: string;
  /** @deprecated Legacy role variant (body/secondary/caption/mono). */
  variant?: TextVariant;
  /** Named TextSize token (3xs..6xl). Default md (15), or sm (13) when the
   *  legacy `caption` variant is used. Raw px is no longer accepted - use a
   *  named step from the kit FONT_SIZE scale. */
  size?: TextSizeToken;
  /** ChatKit font weight. `regular` is a deprecated alias of `normal`. */
  weight?: TextWeight;
  /** Text colour. A semantic ColorToken name (text/link/primary/danger/
   *  success/border) resolves scheme-aware via the kit palette; any other
   *  string is used as a raw colour (escape hatch). Wins over the variant. */
  color?: ColorToken | (string & {});
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

/** Named TextSize px values - the kit FONT_SIZE scale. */
const SIZE_TOKENS = FONT_SIZE;

// Only two Calibre faces are bundled in apps/app: Calibre-Medium and
// Calibre-Semibold. 'Calibre-Regular' is NOT loaded and silently falls back to
// the system font, so it must never be emitted. Weight -> face:
//   normal / medium -> Calibre-Medium
//   semibold / bold -> Calibre-Semibold
// Every Kit Text therefore renders in Calibre with no caller styling.
const FONTS: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

function normalizeWeight(w: TextWeight): keyof typeof FONTS {
  return w === 'regular' ? 'normal' : w;
}

function resolveSize(
  size: TextSizeToken | undefined,
  variant: TextVariant,
): number {
  if (size) return SIZE_TOKENS[size];
  return variant === 'caption' ? SIZE_TOKENS.xs : SIZE_TOKENS.md;
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
    color: color != null
      ? resolveColorToken(color, dark ? 'dark' : 'light')
      : variantColor(variant, dark),
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
