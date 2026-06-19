/** Markdown - a ChatKit-styled markdown node. Mirrors ChatKit's `Markdown`
 *  widget 1:1 on the public API: `value` (the markdown source, required) and
 *  `streaming` (parity flag for in-progress streamed content). The RN
 *  implementation backs it with `react-native-markdown-display` (already an app
 *  dep, used by the chat bubbles + the diff page) so no new dependency is
 *  introduced. Hook-free: caller passes `dark` so colours track the apps/app
 *  palette convention (head / sub). The Calibre family + Menlo-for-code styling
 *  matches `apps/app/lib/diffMarkdownStyles.ts` so Kit Markdown reads identically
 *  to the rest of the app's markdown surfaces. */

import { useMemo } from 'react';
import { type TextStyle } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';

export interface MarkdownProps {
  /** ChatKit: value. The markdown source string. */
  value: string;
  /** ChatKit: streaming. True while the value is still being streamed in
   *  (parity flag; RN render is identical either way). */
  streaming?: boolean;
  /** Override the body text colour; wins over the dark/light default. */
  color?: string;
  /** Override the link colour; defaults to the Metro brand teal link colour. */
  linkColor?: string;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Escape-hatch style merged onto the markdown body. */
  style?: TextStyle;
}

/** Build the react-native-markdown-display style map for the given palette.
 *  Heading/inline sizes MUST live on the leaf rules: the renderer flattens
 *  these into each leaf <Text>'s inheritedStyles and the nearest fontSize wins
 *  in RN, so a wrapping body fontSize can never size headings/strong/em. */
function markdownStyles(fg: string, link: string, dark: boolean): Record<string, object> {
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const lh = 23;
  /** H helper. */
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
    /** fontWeight:'normal' lets the Calibre-Semibold family win (registered as
     *  its own family, not a bold weight of Calibre-Medium). */
    strong: { fontFamily: 'Calibre-Semibold', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    em: { fontFamily: 'Calibre-Medium', fontStyle: 'italic', fontWeight: 'normal', fontSize: 15, lineHeight: lh },
    link: { color: link, textDecorationLine: 'underline' },
    /** Menlo's em-square is wider than Calibre's, so size down to match. */
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo', fontSize: 13, lineHeight: lh },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 13, lineHeight: 19 },
    code_block: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: 13, lineHeight: 19 },
    bullet_list: { marginTop: 2, marginBottom: 6 },
    ordered_list: { marginTop: 2, marginBottom: 6 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}

/** ChatKit-style RN markdown renderer. */
export function Markdown(props: MarkdownProps): React.ReactElement {
  const { value, color, linkColor, dark = false, style } = props;

  const fg = color ?? (dark ? '#ffffff' : '#000000');
  /** Metro brand teal link colour (matches the app palette `link` token). */
  const link = linkColor ?? '#2cc6c6';

  const styles = useMemo(() => {
    const base = markdownStyles(fg, link, dark);
    if (style) base.body = { ...base.body, ...style };
    return base;
  }, [fg, link, dark, style]);

  return <RNMarkdown style={styles}>{value}</RNMarkdown>;
}
