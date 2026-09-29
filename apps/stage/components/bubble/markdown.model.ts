import type { MarkdownIt } from 'react-native-markdown-display';

const STAR = 0x2a;
const TASK_RE = /^\[([ xX])\][ \t]+/;

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

export function taskStateOf(attributes: Record<string, unknown>): TaskState | undefined {
  const task = attributes.task;
  return task === 'todo' || task === 'done' ? task : undefined;
}
