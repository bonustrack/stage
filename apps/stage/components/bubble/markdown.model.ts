import type { MarkdownIt } from 'react-native-markdown-display';
import { cardLinksOf, type CardLink } from '@stage-labs/client/embed/cardLinks';

const STAR = 0x2a;
const TASK_RE = /^\[([ xX])\][ \t]+/;
const LINE_INDENT_RE = /^[ \t]+/gm;
const NBSP = '\u00a0';

export type TaskState = 'todo' | 'done';

export function literalStars(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'literal_star', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== STAR) return false;
    const run = state.scanDelims(state.pos, true);
    if (!run.can_open || !run.can_close) return false;
    if (!silent) state.pending += state.src.slice(state.pos, state.pos + run.length);
    state.pos += run.length;
    return true;
  });
}

type CoreTokens = Parameters<Parameters<MarkdownIt['core']['ruler']['push']>[1]>[0]['tokens'];
type CoreToken = CoreTokens[number];

function opensListItemText(tokens: CoreTokens, index: number): boolean {
  return tokens[index]?.type === 'inline'
    && tokens[index - 1]?.type === 'paragraph_open'
    && tokens[index - 2]?.type === 'list_item_open';
}

function stripTaskMarker(inline: CoreToken): TaskState | undefined {
  const marker = TASK_RE.exec(inline.content);
  const first = inline.children?.[0];
  if (!marker || first?.type !== 'text' || !first.content.startsWith(marker[0])) return undefined;
  first.content = first.content.slice(marker[0].length);
  inline.content = inline.content.slice(marker[0].length);
  return marker[1] === ' ' ? 'todo' : 'done';
}

export function taskLists(md: MarkdownIt): void {
  md.core.ruler.after('inline', 'task_list', state => {
    const { tokens } = state;
    tokens.forEach((token, index) => {
      if (!opensListItemText(tokens, index)) return;
      const task = stripTaskMarker(token);
      if (task) tokens[index - 2]?.attrSet('task', task);
    });
  });
}

function shownIndent(text: string): string {
  return text.replace(LINE_INDENT_RE, run => run.replaceAll('\t', '    ').replaceAll(' ', NBSP));
}

function trimmedLead(state: { src: string; tokens: CoreTokens }, index: number): string {
  const open = state.tokens[index - 1];
  const map = state.tokens[index]?.map;
  if (open?.type !== 'paragraph_open' || open.level !== 0 || !map) return '';
  const line = state.src.split('\n')[map[0]] ?? '';
  return line.slice(0, line.length - line.trimStart().length);
}

export function keepIndent(md: MarkdownIt): void {
  md.disable('code');
  md.core.ruler.before('inline', 'keep_indent', state => {
    state.tokens.forEach((token, index) => {
      if (token.type === 'inline') token.content = shownIndent(trimmedLead(state, index) + token.content);
    });
  });
}

export function taskStateOf(attributes: Record<string, unknown>): TaskState | undefined {
  const task = attributes.task;
  return task === 'todo' || task === 'done' ? task : undefined;
}

const CODE_SPAN_RE = /```[\s\S]*?```|`[^`\n]*`/g;

export function unescapeBody(text: string): string {
  if (!text.includes('\\n') && !text.includes('\\t') && !text.includes('\\r')) return text;
  const unescapeRun = (s: string): string =>
    s.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\\t/g, '\t');
  let out = '';
  let last = 0;
  CODE_SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CODE_SPAN_RE.exec(text)) !== null) {
    out += unescapeRun(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  out += unescapeRun(text.slice(last));
  return out;
}

function rendersBareLink(body: string, md: MarkdownIt): boolean {
  const children = md.parseInline(body, {}).flatMap(token => token.children ?? []);
  const [open, link, close] = children;
  return children.length === 3 && open?.type === 'link_open' && open.markup === 'linkify'
    && link?.type === 'text' && link.content === md.normalizeLinkText(body) && close?.type === 'link_close';
}

export function messageCardLinks(text: string | null | undefined, md: MarkdownIt): CardLink[] {
  const body = unescapeBody(text ?? '').trim();
  const cards = cardLinksOf(body, value => md.linkify.match(value));
  return cards.length > 0 && rendersBareLink(body, md) ? cards : [];
}
