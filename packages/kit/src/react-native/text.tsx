import { useMemo } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';
import { markdownStyles } from '../markdown.styles';
import { resolvePaletteColor, type ColorToken } from '../tokens';
import {
  TEXT_ALIGN_MAP, resolveTextSize, textDefaultColor, textFontFamily,
  type TextAlign, type TextFontFamily, type TextSizeToken, type TextVariant, type TextWeight,
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
  markdown?: boolean;
  style?: TextStyle | TextStyle[];
}

type StyleProps = Pick<TextProps, 'variant' | 'size' | 'fontWeight' | 'textAlign' | 'italic' | 'lineThrough' | 'fontFamily' | 'weight'>;

function baseStyle(p: StyleProps, color: string): TextStyle {
  const base: TextStyle = {
    color,
    fontSize: resolveTextSize(p.size, p.variant),
    fontFamily: textFontFamily(p.fontFamily, p.fontWeight ?? 'normal'),
  };
  if (p.textAlign) base.textAlign = TEXT_ALIGN_MAP[p.textAlign];
  if (p.italic) base.fontStyle = 'italic';
  if (p.lineThrough) base.textDecorationLine = 'line-through';
  return { ...base, ...weightStyle(p.weight) };
}

function useTextColor(color: TextProps['color'], variant: TextVariant | undefined): string {
  const palette = useKitPalette();
  const inherited = useContentColor();
  return color != null ? resolvePaletteColor(color, palette) : textDefaultColor(variant, palette, inherited);
}

interface MarkdownTextProps {
  value: string;
  color: string;
  base: TextStyle;
  style: TextProps['style'];
}

function MarkdownText({ value, color, base, style }: MarkdownTextProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const styles = useMemo(() => {
    const sheet = markdownStyles({ fg: color, dark, fontSize: base.fontSize });
    sheet.body = { ...sheet.body, ...base, ...StyleSheet.flatten(style) };
    return sheet;
  }, [base, color, dark, style]);
  return <RNMarkdown style={styles}>{value}</RNMarkdown>;
}

export function Text(props: TextProps): React.ReactElement {
  const {
    text, variant, size, fontWeight, color, textAlign, italic, lineThrough, truncate = false, maxLines,
    fontFamily, markdown = false, weight, accessibility, style, children, ...rest
  } = props;
  const resolved = useTextColor(color, variant);
  const base = baseStyle({ variant, size, fontWeight, textAlign, italic, lineThrough, fontFamily, weight }, resolved);
  if (markdown && text !== undefined) return <MarkdownText value={text} color={resolved} base={base} style={style} />;
  return (
    <RNText style={style ? [base, style] : base} numberOfLines={truncate ? 1 : maxLines} {...accessibilityProps(accessibility)} {...rest}>
      {children ?? text}
    </RNText>
  );
}
