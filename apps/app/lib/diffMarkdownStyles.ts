/** @file Builds the react-native-markdown-display style map for the PR/issue body on the diff page (Calibre/Menlo, leaf-level font sizes). */
import { fontSize } from '@metro-labs/kit/tokens';
/** Markdown styles for the diff-page PR/issue body, mirroring chat bubbles (Calibre, Menlo for code) at a larger reading size; heading/inline sizes must live here because react-native-markdown-display flattens them into leaf Text styles where the nearest fontSize wins. */

interface DiffMdPalette {
  text: string;
  link: string;
}

/** Build the react-native-markdown-display style map for the diff page's PR/issue body. */
export function diffMarkdownStyles(p: DiffMdPalette, dark: boolean): Record<string, object> {
  const fg = p.text;
  const codeBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const lh = 23;
  /** H helper. */
  const h = (fontSize: number, lineHeight: number): object =>
    ({ color: fg, fontSize, lineHeight, fontFamily: 'Calibre-Semibold', marginTop: 8, marginBottom: 3 });
  return {
    body: { color: fg, fontSize: fontSize('xl'), lineHeight: lh, fontFamily: 'Calibre-Medium' },
    paragraph: { marginTop: 0, marginBottom: 6 },
    heading1: h(24, 28), heading2: h(21, 25), heading3: h(19, 23),
    heading4: h(18, 22), heading5: h(18, 22), heading6: h(18, 22),
    /** fontWeight:'normal' lets the Calibre-Semibold family win (it is registered as its own family, not a bold weight of Calibre-Medium). */
    strong: { fontFamily: 'Calibre-Semibold', fontWeight: 'normal', fontSize: fontSize('xl'), lineHeight: lh },
    em: { fontFamily: 'Calibre-Medium', fontStyle: 'italic', fontWeight: 'normal', fontSize: fontSize('xl'), lineHeight: lh },
    link: { color: p.link, textDecorationLine: 'underline' },
    /** Menlo's em-square is wider than Calibre's, so size down to match. */
    code_inline: { backgroundColor: codeBg, paddingHorizontal: 4, borderRadius: 4, fontFamily: 'Menlo', fontSize: fontSize('md'), lineHeight: lh },
    fence: { backgroundColor: codeBg, padding: 8, borderRadius: 6, fontFamily: 'Menlo', fontSize: fontSize('xs'), lineHeight: 19 },
    bullet_list: { marginTop: 2, marginBottom: 6 },
    ordered_list: { marginTop: 2, marginBottom: 6 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: codeBg, paddingLeft: 8, marginVertical: 4 },
  };
}
