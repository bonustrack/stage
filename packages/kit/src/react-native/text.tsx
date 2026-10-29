import { useMemo } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import RNMarkdown, { MarkdownIt } from 'react-native-markdown-display';
import { markdownStyles } from '../markdown.styles';
import { FONT_SIZE, resolvePaletteColor, type ColorToken } from '../tokens';
import {
  TEXT_ALIGN_MAP,
  resolveTextSize,
  textDefaultColor,
  textFontFamily,
  type TextAlign,
  type TextFontFamily,
  type TextSizeToken,
  type TextVariant,
  type TextWeight,
} from '../text.styles';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { useContentColor } from './content-color';
import { useKitPalette, useKitScheme } from './theme-context';
import { loadKitFonts } from './fonts.load';

loadKitFonts();

export type { TextAlign, TextFontFamily, TextSizeToken, TextVariant, TextWeight };

export interface TextProps extends Omit<RNTextProps, 'style' | 'role'>, A2uiCommonProps {
  text?: string;
  variant?: TextVariant;
  size?: TextSizeToken;
  fontWeight?: TextWeight;
  color?: ColorToken | (string & {});
  textAlign?: TextAlign;
  italic?: boolean;
  lineThrough?: boolean;
  truncate?: boolean;
  maxLines?: number;
  fontFamily?: TextFontFamily;
  letterSpacing?: number;
  textTransform?: TextTransform;
  markdown?: boolean;
  style?: TextStyle | TextStyle[];
}

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

type StyleProps = Pick<
  TextProps,
  'variant' | 'size' | 'fontWeight' | 'textAlign' | 'italic' | 'lineThrough' | 'fontFamily' | 'letterSpacing' | 'textTransform' | 'weight'
>;

function baseStyle(p: StyleProps, color: string): TextStyle {
  const base: TextStyle = {
    color,
    fontSize: resolveTextSize(p.size, p.variant),
    fontFamily: textFontFamily(p.fontFamily, p.fontWeight ?? 'normal'),
  };
  if (p.textAlign) base.textAlign = TEXT_ALIGN_MAP[p.textAlign];
  if (p.italic) base.fontStyle = 'italic';
  if (p.lineThrough) base.textDecorationLine = 'line-through';
  if (p.letterSpacing !== undefined) base.letterSpacing = p.letterSpacing;
  if (p.textTransform !== undefined) base.textTransform = p.textTransform;
  return { ...base, ...weightStyle(p.weight) };
}

function useTextColor(color: TextProps['color'], variant: TextVariant | undefined): string {
  const palette = useKitPalette();
  const inherited = useContentColor();
  return color != null ? resolvePaletteColor(color, palette) : textDefaultColor(variant, palette, inherited);
}

const PLAIN_LINE_HEIGHT = 1.22;
const MARKDOWN_BLOCK_GAP = 8;
const FLOW_BLOCKS = [
  'paragraph',
  'bullet_list',
  'ordered_list',
  'blockquote',
  'fence',
  'code_block',
  'table',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
] as const;

const A2UI_MARKDOWN = MarkdownIt({ html: false, linkify: false, typographer: false }).disable(['image', 'link', 'autolink']);

function MarkdownText({
  value,
  color,
  base,
  style,
}: {
  value: string;
  color: string;
  base: TextStyle;
  style: TextProps['style'];
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const styles = useMemo(() => {
    const fontSize = base.fontSize ?? FONT_SIZE.md;
    const sheet = markdownStyles({ fg: color, dark, fontSize, lineHeight: Math.round(fontSize * PLAIN_LINE_HEIGHT) });
    for (const block of FLOW_BLOCKS) sheet[block] = { ...sheet[block], marginTop: 0, marginBottom: 0 };
    sheet.body = { ...sheet.body, ...base, ...StyleSheet.flatten(style), gap: MARKDOWN_BLOCK_GAP };
    return sheet;
  }, [base, color, dark, style]);
  return (
    <RNMarkdown markdownit={A2UI_MARKDOWN} style={styles}>
      {value}
    </RNMarkdown>
  );
}

export function Text(props: TextProps): React.ReactElement {
  const {
    text,
    variant,
    size,
    fontWeight,
    color,
    textAlign,
    italic,
    lineThrough,
    truncate = false,
    maxLines,
    fontFamily,
    letterSpacing,
    textTransform,
    markdown = false,
    weight,
    accessibility,
    style,
    children,
    ...rest
  } = props;
  const resolved = useTextColor(color, variant);
  const base = baseStyle(
    { variant, size, fontWeight, textAlign, italic, lineThrough, fontFamily, letterSpacing, textTransform, weight },
    resolved,
  );
  if (markdown && text !== undefined) return <MarkdownText value={text} color={resolved} base={base} style={style} />;
  return (
    <RNText style={style ? [base, style] : base} numberOfLines={truncate ? 1 : maxLines} {...accessibilityProps(accessibility)} {...rest}>
      {children ?? text}
    </RNText>
  );
}
