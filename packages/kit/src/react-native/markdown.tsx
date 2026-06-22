
import { useMemo } from 'react';
import { type TextStyle } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';

export interface MarkdownProps {
  value: string;
  streaming?: boolean;
  color?: string;
  linkColor?: string;
  dark?: boolean;
  style?: TextStyle;
}

function markdownStyles(fg: string, link: string, dark: boolean): Record<string, object> {
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const lh = 23;
  const h = (fontSize: number, lineHeight: number): object => ({
    color: fg,
    fontSize,
    lineHeight,
    fontFamily: 'Calibre-Semibold',
    marginTop: 8,
    marginBottom: 3,
  });
  return {
    body: { color: fg, fontSize: 15, lineHeight: lh, fontFamily: 'Calibre-Medium' },
    paragraph: { marginTop: 0, marginBottom: 6 },
    heading1: h(24, 28),
    heading2: h(21, 25),
    heading3: h(19, 23),
    heading4: h(18, 22),
    heading5: h(18, 22),
    heading6: h(18, 22),
    strong: { fontFamily: 'Calibre-Semibold', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    em: { fontFamily: 'Calibre-Medium', fontStyle: 'italic', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    link: { color: link, textDecorationLine: 'underline' },
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo', fontSize: 13, lineHeight: lh },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 13, lineHeight: 19 },
    code_block: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 13, lineHeight: 19 },
    bullet_list: { marginTop: 2, marginBottom: 6 },
    ordered_list: { marginTop: 2, marginBottom: 6 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}

export function Markdown(props: MarkdownProps): React.ReactElement {
  const { value, color, linkColor, dark = false, style } = props;

  const fg = color ?? (dark ? '#ffffff' : '#000000');
  const link = linkColor ?? '#2cc6c6';

  const styles = useMemo(() => {
    const base = markdownStyles(fg, link, dark);
    if (style) base.body = { ...base.body, ...style };
    return base;
  }, [fg, link, dark, style]);

  return <RNMarkdown style={styles}>{value}</RNMarkdown>;
}
