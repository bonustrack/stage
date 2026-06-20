
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { FONT_SIZE, type FontSizeName, resolveColorToken, type ColorToken } from './tokens';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

export type TextVariant = 'body' | 'secondary' | 'caption' | 'mono';

export type TextRole =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'link'
  | 'primary'
  | 'danger'
  | 'success';

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'regular';

export type TextSizeToken = FontSizeName;

export type TextAlign = 'start' | 'center' | 'end';

export interface TextProps extends Omit<RNTextProps, 'style' | 'role'> {
  value?: string;
  role?: TextRole;
  variant?: TextVariant;
  size?: TextSizeToken;
  weight?: TextWeight;
  color?: ColorToken | (string & {});
  textAlign?: TextAlign;
  italic?: boolean;
  lineThrough?: boolean;
  truncate?: boolean;
  maxLines?: number;
  style?: TextStyle | TextStyle[];
}

const SIZE_TOKENS = FONT_SIZE;

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
  variant: TextVariant | undefined,
): number {
  if (size) return SIZE_TOKENS[size];
  return variant === 'caption' ? SIZE_TOKENS.xs : SIZE_TOKENS.md;
}

function variantRole(variant: TextVariant | undefined): TextRole {
  if (variant === 'secondary' || variant === 'caption') return 'secondary';
  return 'default';
}

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

function textColor(
  color: ColorToken | (string & {}) | undefined,
  scheme: 'light' | 'dark',
  role: TextRole,
  palette: KitPalette,
): string {
  return color != null ? resolveColorToken(color, scheme) : roleColor(role, palette);
}

type StyleProps = Pick<
  TextProps,
  'color' | 'role' | 'variant' | 'size' | 'weight' | 'textAlign' | 'italic' | 'lineThrough'
>;

function buildBaseStyle(
  p: StyleProps,
  scheme: 'light' | 'dark',
  palette: KitPalette,
): TextStyle {
  const { color, role, variant, size, weight = 'normal', textAlign, italic, lineThrough } = p;
  const effectiveRole: TextRole = role ?? variantRole(variant);
  const base: TextStyle = {
    color: textColor(color, scheme, effectiveRole, palette),
    fontSize: resolveSize(size, variant),
    fontFamily: variant === 'mono' ? 'Menlo' : FONTS[normalizeWeight(weight)],
  };
  if (textAlign) base.textAlign = ALIGN_MAP[textAlign];
  if (italic) base.fontStyle = 'italic';
  if (lineThrough) base.textDecorationLine = 'line-through';
  return base;
}

function mergeStyle(base: TextStyle, style: TextStyle | TextStyle[] | undefined): TextStyle | TextStyle[] {
  if (!style) return base;
  return [base, ...(Array.isArray(style) ? style : [style])];
}

export function Text(props: TextProps): React.ReactElement {
  const {
    value,
    role,
    variant,
    size,
    weight,
    color,
    textAlign,
    italic,
    lineThrough,
    truncate = false,
    maxLines,
    style,
    children,
    ...rest
  } = props;

  const palette = useKitPalette();
  const scheme = useKitScheme();

  const styleProps: StyleProps = { role, variant, size, weight, color, textAlign, italic, lineThrough };
  const base = buildBaseStyle(styleProps, scheme, palette);
  const clamp = truncate ? 1 : maxLines;
  const content = children ?? value;

  return (
    <RNText style={mergeStyle(base, style)} numberOfLines={clamp} {...rest}>
      {content}
    </RNText>
  );
}
