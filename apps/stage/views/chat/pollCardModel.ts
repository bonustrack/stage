export interface PollOptionInput {
  label: string;
}

export interface PollQuestionInput {
  question: string;
  header?: string;
  options: PollOptionInput[];
  multiSelect?: boolean;
  open?: boolean;
}

export interface PollOptionRow {
  label: string;
  stats: string;
  fillPct: number;
  selected: boolean;
}

export interface PollQuestionBlock {
  question?: string;
  header?: string;
  open: boolean;
  totalLabel: string;
  options: PollOptionRow[];
}

export type PollVotesByQuestion = Map<number, Map<number, Set<string>>>;
export type PollOwnVotesByQuestion = Map<number, Set<number>>;

function optionRow(
  option: PollOptionInput,
  votes: number,
  total: number,
  selected: boolean,
  multiSelect: boolean,
): PollOptionRow {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
  const prefix = selected ? '✓ ' : multiSelect ? '☐ ' : '';
  return {
    label: `${prefix}${option.label}`,
    stats: `${pct}% · ${votes}`,
    fillPct: Math.max(0, Math.min(100, pct)),
    selected,
  };
}

function headerLabel(q: PollQuestionInput): string | undefined {
  if (q.header === undefined) return undefined;
  const base = `${q.header}${q.open === true ? ' · open' : ''}`;
  if (base === '') return undefined;
  return `${base}${q.multiSelect === true ? ' · multi-select' : ''}`;
}

function questionBlock(
  q: PollQuestionInput,
  qi: number,
  multiQuestion: boolean,
  votes: Map<number, Set<string>> | undefined,
  own: Set<number> | undefined,
): PollQuestionBlock {
  const options = Array.isArray(q.options) ? q.options : [];
  const total = options.reduce((n, _o, i) => n + (votes?.get(i)?.size ?? 0), 0);
  const showQuestion = multiQuestion && qi > 0 && q.question !== '';
  return {
    question: showQuestion ? q.question : undefined,
    header: headerLabel(q),
    open: q.open === true,
    totalLabel: `${total} vote${total === 1 ? '' : 's'}`,
    options: options.map((option, i) =>
      optionRow(
        option,
        votes?.get(i)?.size ?? 0,
        total,
        own?.has(i) ?? false,
        q.multiSelect === true,
      ),
    ),
  };
}

export function pollQuestionBlocks(
  questions: PollQuestionInput[],
  votes: PollVotesByQuestion | undefined,
  ownVotes: PollOwnVotesByQuestion | undefined,
): PollQuestionBlock[] {
  const multiQuestion = questions.length > 1;
  return questions.map((q, qi) =>
    questionBlock(q, qi, multiQuestion, votes?.get(qi), ownVotes?.get(qi)),
  );
}
