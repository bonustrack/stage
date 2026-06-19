/**
 * @file Metro poll content type (metro.box/poll:1.0) wire shapes, constants, fallback text, and tally helpers.
 */
/**
 * Metro poll content type - `metro.box/poll:1.0`. Shared between the RN app
 *  (apps/app) and the web client. Pure TypeScript: the interfaces, the wire
 *  constants, the plain-text fallback builder, and the pure tally helpers.
 *
 *  Modeled on Claude Code's AskUserQuestion tool schema
 *  (question / header / options[{label,description}] / multiSelect) plus a
 *  stable `pollId` so votes can reference the poll across edits/resends.
 *
 *  DESIGN: a poll is its own content type, but VOTES reuse the existing
 *  `xmtp.org/reaction:2.0` codec - a vote is a reaction whose `reference` is the
 *  poll's XMTP message id and whose `content` is the chosen option INDEX
 *  (`schema:'custom'`). That means votes decode on every client, sync
 *  cross-device, and reuse the whole reaction tally + optimistic-UI machinery
 *  with zero new codec on the vote path.
 */

export interface PollOption {
  /** Shown as the choice button text. Keep <= ~40 chars. */
  label: string;
  /** Optional one-line subtitle under the label. */
  description?: string;
}

/** One question of a (possibly multi-question) poll. Mirrors a single entry in AskUserQuestion's `questions[]`. The QUESTION INDEX (position in `questions[]`) plus the OPTION INDEX form the canonical vote key. */
export interface PollQuestion {
  question: string;
  /** Optional short ALL-CAPS eyebrow (AskUserQuestion `header`), <= ~12 chars. */
  header?: string;
  /** 2..n choices. The option INDEX is the canonical vote key. May be EMPTY for a pure free-text (`open`) question. */
  options: PollOption[];
  /** Default false. true => multi-select for THIS question. */
  multiSelect?: boolean;
  /**
   * Default false. true => this question accepts a FREE-TEXT answer (mirrors
   *  AskUserQuestion's always-available "Other"). May stand alone (no options =
   *  pure free-text) or accompany options (pick one, or type your own). Open
   *  answers are NOT option-index votes; they are carried as custom-schema vote
   *  events whose content is `open:<q>:<text>` (see poll-tally).
   */
  open?: boolean;
}

export interface PollContent {
  /** Stable id minted at creation; survives edits/resends so votes can reference it. (The canonical vote reference is still the message id.) */
  pollId: string;
  /** AskUserQuestion-shaped MULTI-question form: one block per question. When present (non-empty) this is authoritative; the legacy top-level fields are ignored. New senders should prefer this. */
  questions?: PollQuestion[];
  /** LEGACY single-question prompt. Kept for backward compat with v1 polls; `normalizeQuestions()` folds either shape into one `PollQuestion[]`. */
  question?: string;
  /** LEGACY single-question header. */
  header?: string;
  /** LEGACY single-question options. The option INDEX is the canonical vote key. */
  options?: PollOption[];
  /** LEGACY single-question multiSelect. */
  multiSelect?: boolean;
  // allowOther is intentionally omitted: a poll is a closed set.
}

/** Fold either poll shape into a `PollQuestion[]`. Multi-question polls return their `questions[]`; legacy single-question polls return a one-element array. Option strings are coerced to `{label}`. Never throws (bad poll => `[]`). */
export function normalizeQuestions(poll: PollContent | undefined): PollQuestion[] {
  if (!poll) return [];
  /** Coerce helper. */
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

/** Full content-type id string, RN-SDK form. */
export const POLL_CONTENT_TYPE_ID = 'metro.box/poll:1.0';
/** Authority-less short form used by the envelope/preview switches. */
export const POLL_CONTENT_TYPE_SHORT = 'poll';

/** Mint a stable poll id. Uses `crypto.randomUUID()` where available (RN Hermes + modern browsers via the app's existing getRandomValues polyfill), with a cheap fallback so the helper never throws in a bare environment. */
export function mintPollId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `poll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Plain-text rendering used as the EncodedContent.fallback (so vanilla XMTP clients render something readable) and as the envelope `text`. */
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

/** One-line preview for the channels list / daemon preview. */
export function pollPreviewText(poll: PollContent): string {
  const qs = normalizeQuestions(poll);
  const title = qs[0]?.question ?? poll.question ?? '';
  return qs.length > 1 ? `Poll: ${title} (+${qs.length - 1} more)` : `Poll: ${title}`;
}

export {
  parseVoteKey, voteKey, votesByPoll, ownVotes,
  openVoteKey, parseOpenVote, openAnswersByPoll,
  type VoteEvent,
} from './poll-tally';
