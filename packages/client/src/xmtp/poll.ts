import { mintId } from '../mintId';
import type { PollContent } from './poll.schema';

export type { PollContent } from './poll.schema';

export interface PollOption {
  label: string;
  description?: string;
}

export interface PollQuestion {
  question: string;
  header?: string;
  options: PollOption[];
  multiSelect?: boolean;
  open?: boolean;
}

export function normalizeQuestions(poll: PollContent | undefined): PollQuestion[] {
  if (!poll) return [];
  const coerce = (o: (PollOption | string)[] | undefined): PollOption[] =>
    Array.isArray(o) ? o.map(x => (typeof x === 'string' ? { label: x } : x)) : [];
  const qs = poll.questions;
  if (Array.isArray(qs) && qs.length > 0) {
    return qs.map(q => ({
      question: q.question, ...(q.header ? { header: q.header } : {}),
      multiSelect: q.multiSelect === true,
      ...(q.open === true ? { open: true } : {}),
      options: coerce(q.options as (PollOption | string)[] | undefined),
    }));
  }
  if (typeof poll.question === 'string' && Array.isArray(poll.options)) {
    return [{
      question: poll.question, ...(poll.header ? { header: poll.header } : {}),
      multiSelect: poll.multiSelect === true, options: coerce(poll.options),
    }];
  }
  return [];
}

export function mintPollId(): string {
  return mintId('poll');
}

export function pollFallbackText(poll: PollContent): string {
  const qs = normalizeQuestions(poll);
  const title = qs[0]?.question ?? poll.question ?? 'Poll';
  const lines = [`📊 Poll: ${title}`];
  if (qs.length <= 1) {
    (qs[0]?.options ?? []).forEach((o, i) => lines.push(`${i + 1}. ${o.label}`));
    if (qs[0]?.open) lines.push('(or type your own answer)');
  } else {
    qs.forEach((q, qi) => {
      lines.push(`Q${qi + 1}. ${q.question}`);
      (q.options ?? []).forEach((o, i) => lines.push(`  ${i + 1}. ${o.label}`));
      if (q.open) lines.push('  (or type your own answer)');
    });
  }
  lines.push('Reply with a number to vote.');
  return lines.join('\n');
}

export { openVoteKey } from './poll-tally';
