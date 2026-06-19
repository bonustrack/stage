/**
 * @file Text — a theme-native RN text component matching ChatKit's Text/BaseTextProps API that resolves its colour by semantic role from useKitPalette, with deprecated back-compat variant/size/weight aliases.
 */

import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { FONT_SIZE, type FontSizeName, resolveColorToken, type ColorToken } from './tokens';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

/** @deprecated Legacy role-name `variant`. Mapped onto colour + font family. */
export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

/** Semantic text role - resolved scheme-aware from the Kit theme palette. `default` is today's body text colour exactly (lossless). */
export type TextRole =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'link'
  | 'primary'
  | 'danger'
  | 'success';

/** ChatKit font weight, plus the legacy `regular` alias of `normal`. */
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

/** Named TextSize scale (3xs..6xl). Single source of truth in tokens.ts. */
export type TextSizeToken = FontSizeName;

/** ChatKit text alignment. */
export type TextAlign = 'start' | 'center' | 'end';

export interface TextProps extends Omit<RNTextProps, 'style' | 'role'> {
  /** ChatKit `value`. Ignored if `children` is provided. */
  value?: string;
  /** Semantic text role - resolves scheme-aware from the theme palette. Default `default` = body text. */
  role?: TextRole;
  /**
   * @deprecated Legacy role variant (body/secondary/caption/mono). Maps onto
   *  the new `role` (secondary/caption -> secondary).
   */
  variant?: TextVariant;
  /** Named TextSize token (3xs..6xl). Default md (15), or sm (13) when the legacy `caption` variant is used. */
  size?: TextSizeToken;
  /** ChatKit font weight. `regular` is a deprecated alias of `normal`. */
  weight?: TextWeight;
  /** Override colour (escape hatch). A semantic ColorToken name resolves scheme-aware; any other string is a raw colour. Wins over `role`. */
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
  /** Escape-hatch style merged last. */
  style?: TextStyle | TextStyle[];
}

/** Named TextSize px values - the kit FONT_SIZE scale. */
const SIZE_TOKENS = FONT_SIZE;

// Only two Calibre faces are bundled in apps/app: Calibre-Medium and
// Calibre-Semibold. Weight -> face:
//   normal / medium -> Calibre-Medium
//   semibold / bold -> Calibre-Semibold
const FONTS: Record<'normal' | 'medium' | 'semibold' | 'bold', string> = {
  normal: 'Calibre-Medium',
  medium: 'Calibre-Medium',
  semibold: 'Calibre-Semibold',
  bold: 'Calibre-Semibold',
};

/** Normalize Weight. */
function normalizeWeight(w: TextWeight): keyof typeof FONTS {
  return w === 'regular' ? 'normal' : w;
}

/** Resolve Size. */
function resolveSize(
  size: TextSizeToken | undefined,
  variant: TextVariant | undefined,
): number {
  if (size) return SIZE_TOKENS[size];
  return variant === 'caption' ? SIZE_TOKENS.xs : SIZE_TOKENS.md;
}

/** Map the legacy `variant` onto a semantic role. */
function variantRole(variant: TextVariant | undefined): TextRole {
  if (variant === 'secondary' || variant === 'caption') return 'secondary';
  return 'default';
}

/**
 * Resolve a role to a palette colour.
 *  LOSSLESS NOTE: today's Kit Text default (`variant="body"`) rendered the
 *  `head` colour (#ffffff/#000000), which in the app palette is `link`
 *  (link-* === head-* hexes), NOT the `fg` body-grey `text`. So `default`
 *  resolves to `palette.link` to stay pixel-identical to today. (The design
 *  brief labelled default `=text`; that would have re-coloured every default
 *  Text from white/black to grey, so it is intentionally mapped to `link`.)
 */
function roleColor(role: TextRole, palette: KitPalette): string {
  switch (role) {
    case 'secondary':
    case 'muted':
      return palette.sub;
    case 'link':
      return palette.link;
    case 'primary':
      return palette.primary;
    case 'danger':
      return palette.danger;
    case 'success':
      return palette.success;
    default:
      return palette.link;
  }
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
    role,
    variant,
    size,
    weight = 'normal',
    color,
    textAlign,
    italic = false,
    lineThrough = false,
    truncate = false,
    maxLines,
    style,
    children,
    ...rest
  } = props;

  const palette = useKitPalette();
  const scheme = useKitScheme();
  const effectiveRole: TextRole = role ?? variantRole(variant);

  const base: TextStyle = {
    color: color != null
      ? resolveColorToken(color, scheme)
      : roleColor(effectiveRole, palette),
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
