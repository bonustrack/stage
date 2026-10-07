import { FONT_SIZE, fontName, schemePalette } from './tokens';

export interface MarkdownStyleOptions {
  fg: string;
  dark: boolean;
  link?: string;
  fontSize?: number;
  lineHeight?: number;
  paragraphGap?: number;
}

export const MARKDOWN_LINK = { dark: '#7aa2ff', light: '#2f6feb' } as const;

const CODE_BG = { dark: 'rgba(255,255,255,0.1)', light: 'rgba(0,0,0,0.07)' } as const;
const CODE_RADIUS = 4;
const BLOCK_RADIUS = 8;
const BLOCK_PAD = 10;
const QUOTE_BAR = 4;
const HEADING_SCALE = [1.6, 1.35, 1.15, 1, 1, 1] as const;
const HEADING_SIZES = [FONT_SIZE['2xl'], FONT_SIZE.xl, FONT_SIZE.sm, FONT_SIZE.xs, FONT_SIZE.xs, FONT_SIZE.xs];
const HEADING_MIN_GAP = { top: 6, bottom: 2 } as const;

function heading(fg: string, fontSize: number, gap: number): object {
  return {
    color: fg,
    fontSize,
    lineHeight: Math.round(fontSize * 1.25),
    fontFamily: fontName.head,
    fontWeight: 'normal',
    marginTop: Math.max(gap * 1.5, HEADING_MIN_GAP.top),
    marginBottom: Math.max(gap / 2, HEADING_MIN_GAP.bottom),
  };
}

function codeStyles(dark: boolean, border: string, lineHeight: number, gap: number): Record<string, object> {
  const bg = dark ? CODE_BG.dark : CODE_BG.light;
  const block = {
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: border,
    borderRadius: BLOCK_RADIUS,
    padding: BLOCK_PAD,
    fontFamily: fontName.mono,
    fontSize: FONT_SIZE['4xs'],
    lineHeight: Math.round(FONT_SIZE['4xs'] * 1.5),
    marginTop: 0,
    marginBottom: gap,
  };
  return {
    code_inline: {
      backgroundColor: bg,
      borderWidth: 0,
      borderRadius: CODE_RADIUS,
      paddingHorizontal: 4,
      paddingVertical: 1,
      fontFamily: fontName.mono,
      fontSize: FONT_SIZE['3xs'],
      lineHeight,
    },
    code_block: block,
    fence: block,
  };
}

function tableStyles(border: string, gap: number): Record<string, object> {
  return {
    table: { borderWidth: 1, borderColor: border, borderRadius: BLOCK_RADIUS, marginBottom: gap, overflow: 'hidden' },
    thead: {},
    tbody: {},
    tr: { borderBottomWidth: 1, borderColor: border, flexDirection: 'row' },
    th: { flex: 1, paddingHorizontal: BLOCK_PAD, paddingVertical: 6, fontFamily: fontName.head },
    td: { flex: 1, paddingHorizontal: BLOCK_PAD, paddingVertical: 6 },
  };
}

export function markdownStyles(options: MarkdownStyleOptions): Record<string, object> {
  const { fg, dark } = options;
  const pal = schemePalette(dark);
  const base = options.fontSize ?? FONT_SIZE.xs;
  const lineHeight = options.lineHeight ?? Math.round(base * 1.45);
  const gap = options.paragraphGap ?? 8;
  const link = options.link ?? (dark ? MARKDOWN_LINK.dark : MARKDOWN_LINK.light);
  const inline = { fontSize: base, lineHeight };
  const headings = options.fontSize === undefined ? HEADING_SIZES : HEADING_SCALE.map((scale) => Math.round(base * scale));
  return {
    body: { color: fg, fontSize: base, lineHeight, fontFamily: fontName.sans },
    paragraph: { marginTop: 0, marginBottom: gap },
    textgroup: { minWidth: 0 },
    ...Object.fromEntries(headings.map((size, index) => [`heading${index + 1}`, heading(fg, size, gap)])),
    strong: { ...inline, fontFamily: fontName.head, fontWeight: 'normal' },
    em: { ...inline, fontFamily: fontName.sans, fontStyle: 'italic', fontWeight: 'normal' },
    s: { textDecorationLine: 'line-through' },
    link: { color: link, textDecorationLine: 'none' },
    blocklink: { borderBottomWidth: 0 },
    hr: { backgroundColor: pal.border, height: 1, marginVertical: gap * 1.5 },
    blockquote: {
      backgroundColor: 'transparent',
      borderLeftWidth: QUOTE_BAR,
      borderColor: pal.border,
      borderRadius: QUOTE_BAR / 2,
      marginLeft: 0,
      paddingHorizontal: BLOCK_PAD + 2,
      paddingVertical: 0,
      marginBottom: gap,
    },
    bullet_list: { marginTop: 0, marginBottom: gap },
    ordered_list: { marginTop: 0, marginBottom: gap },
    list_item: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 2 },
    bullet_list_icon: { marginLeft: 4, marginRight: 8, color: pal.sub, ...inline },
    ordered_list_icon: { marginLeft: 4, marginRight: 8, color: pal.sub, ...inline },
    bullet_list_content: { flex: 1 },
    ordered_list_content: { flex: 1 },
    ...codeStyles(dark, pal.border, lineHeight, gap),
    ...tableStyles(pal.border, gap),
    image: { flex: 1, borderRadius: BLOCK_RADIUS },
  };
}
