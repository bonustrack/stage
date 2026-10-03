import { decodeEntities } from './htmlEntities';

export interface MailSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

export interface MailTextBlock {
  type: 'text';
  spans: MailSpan[];
  heading: number;
  quote: number;
  bullet: string | null;
  pre: boolean;
}

export interface MailImageBlock {
  type: 'image';
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  remote: boolean;
}

export type MailBlock = MailTextBlock | MailImageBlock | { type: 'rule' };

type SpanStyle = Omit<MailSpan, 'text'>;
type StyleFlag = 'bold' | 'italic' | 'underline' | 'code';

interface Frame {
  tag: string;
  href: string | null;
  hidden: boolean;
  next: number;
}

interface Builder {
  blocks: MailBlock[];
  spans: MailSpan[];
  stack: Frame[];
  bullet: string | null;
  inline: ReadonlyMap<string, string>;
}

interface Tag {
  name: string;
  closing: boolean;
  attrs: Map<string, string>;
  end: number;
}

const MAX_HTML_CHARS = 2_000_000;
const MAX_BLOCKS = 3000;
const MAX_STACK = 256;
const PIXEL_MAX = 2;
const BULLET = '•';
const SINGLE_QUOTE = '\'';

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'center', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'html', 'li', 'main', 'nav', 'ol', 'p',
  'pre', 'section', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul',
]);
const VOID_TAGS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT_TAGS: ReadonlySet<string> = new Set([
  'iframe', 'noembed', 'noframes', 'noscript', 'script', 'style', 'textarea', 'title', 'xmp',
]);
const HIDDEN_TAGS: ReadonlySet<string> = new Set(['head', 'math', 'object', 'select', 'svg', 'template']);
const STYLE_TAGS: Readonly<Record<string, StyleFlag>> = {
  b: 'bold', strong: 'bold', th: 'bold', h1: 'bold', h2: 'bold', h3: 'bold', h4: 'bold', h5: 'bold', h6: 'bold',
  i: 'italic', em: 'italic', cite: 'italic', u: 'underline', ins: 'underline',
  code: 'code', kbd: 'code', samp: 'code', tt: 'code', pre: 'code',
};
const HEADINGS: Readonly<Record<string, number>> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all/i;
const INVISIBLE = /[\u00ad\u034f\u200b-\u200f\u2060\ufeff]/g;
const TAG_NAME = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/y;
const ATTR_NAME = /[^\s"'>/=]+/y;
const UNQUOTED = /[^\s>]*/y;
const SPACE = /\s*/y;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;
const DATA_IMAGE = /^data:image\/(?:png|gif|jpe?g|webp);base64,/i;

function top(b: Builder): Frame | undefined {
  return b.stack[b.stack.length - 1];
}

function skipSpace(html: string, at: number): number {
  SPACE.lastIndex = at;
  SPACE.exec(html);
  return SPACE.lastIndex;
}

function readValue(html: string, at: number): { text: string; end: number } {
  const quote = html[at];
  if (quote === '"' || quote === SINGLE_QUOTE) {
    const close = html.indexOf(quote, at + 1);
    const end = close === -1 ? html.length : close;
    return { text: html.slice(at + 1, end), end: Math.min(end + 1, html.length) };
  }
  UNQUOTED.lastIndex = at;
  const text = UNQUOTED.exec(html)?.[0] ?? '';
  return { text, end: at + text.length };
}

function readAttr(html: string, at: number, attrs: Map<string, string>): number {
  ATTR_NAME.lastIndex = at;
  const match = ATTR_NAME.exec(html);
  if (match === null) return at + 1;
  const name = match[0].toLowerCase();
  const after = skipSpace(html, ATTR_NAME.lastIndex);
  if (html[after] !== '=') {
    if (!attrs.has(name)) attrs.set(name, '');
    return after;
  }
  const value = readValue(html, skipSpace(html, after + 1));
  if (!attrs.has(name)) attrs.set(name, decodeEntities(value.text));
  return value.end;
}

function readTag(html: string, at: number): Tag | null {
  TAG_NAME.lastIndex = at;
  const head = TAG_NAME.exec(html);
  if (head === null) return null;
  const tag: Tag = { name: (head[2] ?? '').toLowerCase(), closing: head[1] === '/', attrs: new Map(), end: html.length };
  let pos = TAG_NAME.lastIndex;
  while (pos < html.length) {
    pos = skipSpace(html, pos);
    if (html[pos] === '>') return { ...tag, end: pos + 1 };
    pos = html[pos] === '/' ? pos + 1 : readAttr(html, pos, tag.attrs);
  }
  return tag;
}

function contextOf(stack: readonly Frame[]): { hidden: boolean; pre: boolean; quote: number; heading: number } {
  const context = { hidden: false, pre: false, quote: 0, heading: 0 };
  for (const frame of stack) {
    context.hidden ||= frame.hidden;
    context.pre ||= frame.tag === 'pre';
    context.quote += frame.tag === 'blockquote' ? 1 : 0;
    context.heading = HEADINGS[frame.tag] ?? context.heading;
  }
  return context;
}

function styleOf(stack: readonly Frame[]): SpanStyle {
  const style: SpanStyle = {};
  for (const frame of stack) {
    const flag = STYLE_TAGS[frame.tag];
    if (flag !== undefined) style[flag] = true;
    if (frame.href !== null) style.href = frame.href;
  }
  return style;
}

function sameStyle(a: SpanStyle, b: SpanStyle): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.code === b.code && a.href === b.href;
}

function appendSpan(b: Builder, text: string, style: SpanStyle): void {
  const last = b.spans[b.spans.length - 1];
  const prev = last?.text ?? '';
  const clean = text.startsWith(' ') && (last === undefined || prev.endsWith(' ') || prev.endsWith('\n')) ? text.slice(1) : text;
  if (clean === '') return;
  if (last !== undefined && sameStyle(last, style)) last.text += clean;
  else b.spans.push({ ...style, text: clean });
}

function addText(b: Builder, raw: string): void {
  const context = contextOf(b.stack);
  if (context.hidden) return;
  const text = context.pre ? raw : raw.replace(/\s+/g, ' ');
  appendSpan(b, decodeEntities(text).replace(INVISIBLE, ''), styleOf(b.stack));
}

function trimSpans(spans: MailSpan[]): MailSpan[] {
  const out = spans.map((span) => ({ ...span, text: span.text.replace(/\n{3,}/g, '\n\n') }));
  const first = out[0];
  if (first !== undefined) first.text = first.text.trimStart();
  const last = out[out.length - 1];
  if (last !== undefined) last.text = last.text.trimEnd();
  return out.filter((span) => span.text !== '');
}

function flush(b: Builder): void {
  const spans = trimSpans(b.spans);
  b.spans = [];
  if (spans.length === 0) return;
  const { quote, heading, pre } = contextOf(b.stack);
  b.blocks.push({ type: 'text', spans, heading, quote, bullet: b.bullet, pre });
  b.bullet = null;
}

function dimension(value: string | undefined): number | null {
  const parsed = value === undefined ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inlineSource(cid: string, inline: ReadonlyMap<string, string>): string | null {
  let decoded = cid;
  try {
    decoded = decodeURIComponent(cid);
  } catch {
    decoded = cid;
  }
  return inline.get(cid) ?? inline.get(decoded) ?? null;
}

function imageSource(src: string, inline: ReadonlyMap<string, string>): { src: string; remote: boolean } | null {
  const value = src.trim();
  if (/^https?:\/\//i.test(value)) return { src: value, remote: true };
  if (DATA_IMAGE.test(value)) return { src: value, remote: false };
  const cid = /^cid:/i.test(value) ? inlineSource(value.slice(4), inline) : null;
  return cid === null ? null : { src: cid, remote: false };
}

function isPixel(width: number | null, height: number | null): boolean {
  return (width !== null && width <= PIXEL_MAX) || (height !== null && height <= PIXEL_MAX);
}

function addImage(b: Builder, attrs: ReadonlyMap<string, string>): void {
  const source = imageSource(attrs.get('src') ?? '', b.inline);
  const width = dimension(attrs.get('width'));
  const height = dimension(attrs.get('height'));
  if (source === null || isPixel(width, height) || contextOf(b.stack).hidden) return;
  flush(b);
  b.blocks.push({ type: 'image', ...source, alt: attrs.get('alt') ?? '', width, height });
}

function nextBullet(stack: readonly Frame[]): string {
  const list = [...stack].reverse().find((frame) => frame.tag === 'ul' || frame.tag === 'ol');
  if (list?.tag !== 'ol') return BULLET;
  list.next += 1;
  return `${list.next - 1}.`;
}

function safeHref(href: string | undefined): string | null {
  const value = (href ?? '').replace(/\s/g, '');
  const control = Array.from(value).some((ch) => ch.charCodeAt(0) < 0x20);
  return !control && SAFE_HREF.test(value) ? value : null;
}

function isHidden(name: string, attrs: ReadonlyMap<string, string>): boolean {
  return HIDDEN_TAGS.has(name) || attrs.has('hidden') || HIDDEN_STYLE.test(attrs.get('style') ?? '');
}

function openVoid(b: Builder, tag: Tag): void {
  if (tag.name === 'br') appendSpan(b, '\n', styleOf(b.stack));
  if (tag.name === 'img') addImage(b, tag.attrs);
  if (tag.name !== 'hr' || contextOf(b.stack).hidden) return;
  flush(b);
  b.blocks.push({ type: 'rule' });
}

function pushFrame(b: Builder, tag: Tag): void {
  if (b.stack.length >= MAX_STACK) return;
  const href = tag.name === 'a' ? safeHref(tag.attrs.get('href')) : (top(b)?.href ?? null);
  const next = Number(tag.attrs.get('start') ?? 1);
  b.stack.push({ tag: tag.name, href, hidden: isHidden(tag.name, tag.attrs), next: Number.isFinite(next) ? next : 1 });
}

function openTag(b: Builder, tag: Tag): void {
  if (BLOCK_TAGS.has(tag.name)) flush(b);
  if (VOID_TAGS.has(tag.name)) {
    openVoid(b, tag);
    return;
  }
  if (tag.name === 'li') b.bullet = nextBullet(b.stack);
  if (tag.name === 'td' || tag.name === 'th') appendSpan(b, ' ', styleOf(b.stack));
  pushFrame(b, tag);
}

function closeTag(b: Builder, name: string): void {
  const at = b.stack.map((frame) => frame.tag).lastIndexOf(name);
  if (at === -1) return;
  if (BLOCK_TAGS.has(name)) flush(b);
  b.stack.length = at;
}

function skipPast(html: string, at: number, marker: string): number {
  const end = html.indexOf(marker, at);
  return end === -1 ? html.length : end + marker.length;
}

function skipRawText(html: string, from: number, name: string): number {
  const close = new RegExp(`</${name}[\\s/>]`, 'gi');
  close.lastIndex = from;
  const found = close.exec(html);
  return found === null ? html.length : skipPast(html, found.index, '>');
}

function markup(b: Builder, html: string, at: number): number {
  if (html.startsWith('<!--', at)) return skipPast(html, at + 4, '-->');
  if (html.startsWith('<!', at) || html.startsWith('<?', at)) return skipPast(html, at, '>');
  const tag = readTag(html, at);
  if (tag === null) {
    addText(b, '<');
    return at + 1;
  }
  if (tag.closing) closeTag(b, tag.name);
  else if (RAW_TEXT_TAGS.has(tag.name)) return skipRawText(html, tag.end, tag.name);
  else openTag(b, tag);
  return tag.end;
}

function step(b: Builder, html: string, at: number): number {
  const lt = html.indexOf('<', at);
  const end = lt === -1 ? html.length : lt;
  if (end > at) {
    addText(b, html.slice(at, end));
    return end;
  }
  return markup(b, html, at);
}

export function mailHtmlBlocks(html: string, inline: ReadonlyMap<string, string> = new Map()): MailBlock[] {
  const source = html.slice(0, MAX_HTML_CHARS);
  const b: Builder = { blocks: [], spans: [], stack: [], bullet: null, inline };
  let at = 0;
  while (at < source.length && b.blocks.length < MAX_BLOCKS) at = step(b, source, at);
  flush(b);
  return b.blocks.slice(0, MAX_BLOCKS);
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/g;

function linkSpans(text: string): MailSpan[] {
  const spans: MailSpan[] = [];
  let at = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const url = match[0].replace(/[).,;:!?\]'"]+$/, '');
    if (match.index > at) spans.push({ text: text.slice(at, match.index) });
    spans.push({ text: url, href: url });
    at = match.index + url.length;
  }
  if (at < text.length) spans.push({ text: text.slice(at) });
  return spans;
}

export function mailTextBlocks(text: string): MailBlock[] {
  return text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/^\n+/, '').trimEnd())
    .filter((paragraph) => paragraph !== '')
    .slice(0, MAX_BLOCKS)
    .map((paragraph): MailBlock => ({ type: 'text', spans: linkSpans(paragraph), heading: 0, quote: 0, bullet: null, pre: false }));
}

export function hasRemoteImages(blocks: readonly MailBlock[]): boolean {
  return blocks.some((block) => block.type === 'image' && block.remote);
}
