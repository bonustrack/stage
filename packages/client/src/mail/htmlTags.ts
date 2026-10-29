import { decodeEntities } from './htmlEntities';

export interface Tag {
  name: string;
  closing: boolean;
  attrs: Map<string, string>;
  end: number;
}

const SINGLE_QUOTE = "'";
const TAG_NAME = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/y;
const ATTR_NAME = /[^\s"'>/=]+/y;
const UNQUOTED = /[^\s>]*/y;
const SPACE = /\s*/y;

export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'center',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'html',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tbody',
  'tfoot',
  'thead',
  'tr',
  'ul',
]);
export const VOID_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
export const RAW_TEXT_TAGS: ReadonlySet<string> = new Set([
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
]);
export const HIDDEN_TAGS: ReadonlySet<string> = new Set(['head', 'math', 'object', 'select', 'svg', 'template']);

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

export function readTag(html: string, at: number): Tag | null {
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

export function skipPast(html: string, at: number, marker: string): number {
  const end = html.indexOf(marker, at);
  return end === -1 ? html.length : end + marker.length;
}

export function skipRawText(html: string, from: number, name: string): number {
  const close = new RegExp(`</${name}[\\s/>]`, 'gi');
  close.lastIndex = from;
  const found = close.exec(html);
  return found === null ? html.length : skipPast(html, found.index, '>');
}
