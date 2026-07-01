
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { resolveColorToken, type ColorToken } from '../tokens';
import {
  TEXT_ALIGN_MAP,
  textFontFamily,
  textRoleColor,
  textVariantRole,
  resolveTextSize,
  type TextAlign,
  type TextRole,
  type TextSizeToken,
  type TextVariant,
  type TextWeight,
} from '../text.styles';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

export type { TextAlign, TextRole, TextSizeToken, TextVariant, TextWeight };

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

function textColor(
  color: ColorToken | (string & {}) | undefined,
  scheme: 'light' | 'dark',
  role: TextRole,
  palette: KitPalette,
): string {
  return color != null ? resolveColorToken(color, scheme) : textRoleColor(role, palette);
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
  const effectiveRole: TextRole = role ?? textVariantRole(variant);
  const base: TextStyle = {
    color: textColor(color, scheme, effectiveRole, palette),
    fontSize: resolveTextSize(size, variant),
    fontFamily: textFontFamily(variant, weight),
  };
  if (textAlign) base.textAlign = TEXT_ALIGN_MAP[textAlign];
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
