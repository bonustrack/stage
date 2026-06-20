/** @file Pure feed-derivation helpers for the XMTP conversation screen — extracted from app/xmtp/[convId].tsx verbatim (phase-2 lint split). Behavior identical. */

import {
  votesByPoll as tallyVotes, ownVotes as tallyOwnVotes,
  openAnswersByPoll as tallyOpenAnswers,
  normalizeQuestions, type VoteEvent, type PollContent, type PollQuestion,
} from '@stage-labs/client/xmtp/poll';
import { humanizeMentions, attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from '../../lib/types';

/** Whether an entry carries attachments — used to dedup an optimistic attachment-only send (empty text) against its confirmed twin. */
export function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

/** True when a reaction is actually a poll VOTE (not an emoji pill): tagged `schema:'custom'`, or a reaction on a poll bubble whose content is a valid non-negative option index; genuine emoji reactions aren't integers, so they stay pills. */
function isPollVote(
  p: { reactTo?: string; emoji?: string; schema?: string } | undefined,
  pollOptionCounts: Map<string, number>,
): boolean {
  if (!p) return false;
  if (p.schema === 'custom') return true;
  if (!p.reactTo || !p.emoji) return false;
  const optionCount = pollOptionCounts.get(p.reactTo);
  if (optionCount === undefined) return false; /** not a reaction on a poll */
  if (!/^\d+$/.test(p.emoji)) return false; /** a real emoji, not a bare index */
  const idx = Number.parseInt(p.emoji, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < optionCount;
}

/** A genuine emoji reaction payload, after poll-vote + missing-field filtering. */
interface ReactionPayload { reactTo: string; emoji: string; removed: boolean }

/** Extract the genuine emoji-reaction payload from an entry, or null (poll vote / not a reaction). */
function reactionPayloadOf(e: HistoryEntry, pollOptionCounts: Map<string, number>): ReactionPayload | null {
  const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
  /** Skip poll VOTES — tallied separately; genuine emoji reactions on a poll stay pills. */
  if (isPollVote(p, pollOptionCounts)) return null;
  if (!p?.reactTo || !p.emoji) return null;
  return { reactTo: p.reactTo, emoji: p.emoji, removed: !!p.removed };
}

/** Fold reactions into the latest (add/remove) state per dedupe key, keeping the newest event per key. */
function latestReactions(
  events: HistoryEntry[], pollOptionCounts: Map<string, number>,
  keyOf: (e: HistoryEntry, p: ReactionPayload) => string | null,
): Map<string, { ts: string; removed: boolean; reactTo: string; emoji: string }> {
  const latest = new Map<string, { ts: string; removed: boolean; reactTo: string; emoji: string }>();
  for (const e of events) {
    const p = reactionPayloadOf(e, pollOptionCounts);
    if (!p) continue;
    const k = keyOf(e, p);
    if (k === null) continue;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: p.removed, reactTo: p.reactTo, emoji: p.emoji });
  }
  return latest;
}

/** Reaction events decorate their target msg — fold them into per-message, per-emoji counts rather than rendering as standalone bubbles. */
export function reactionsByMessage(events: HistoryEntry[], pollOptionCounts: Map<string, number>): Map<string, Map<string, number>> {
  const latest = latestReactions(events, pollOptionCounts, (e, p) => `${p.reactTo} ${p.emoji} ${e.from}`);
  const out = new Map<string, Map<string, number>>();
  for (const v of latest.values()) {
    if (v.removed) continue;
    let m = out.get(v.reactTo);
    if (!m) { m = new Map(); out.set(v.reactTo, m); }
    m.set(v.emoji, (m.get(v.emoji) ?? 0) + 1);
  }
  return out;
}

/** Emojis the local user currently has on each message (latest add not undone by a later removal). Drives un-react. */
export function ownReactionsByMessage(events: HistoryEntry[], myUri: string, pollOptionCounts: Map<string, number>): Map<string, Set<string>> {
  const latest = latestReactions(
    events, pollOptionCounts,
    (e, p) => (e.from === myUri ? `${p.reactTo} ${p.emoji}` : null),
  );
  const out = new Map<string, Set<string>>();
  for (const v of latest.values()) {
    if (v.removed) continue;
    let s = out.get(v.reactTo);
    if (!s) { s = new Set(); out.set(v.reactTo, s); }
    s.add(v.emoji);
  }
  return out;
}

/** Returns whether a history entry is a reaction rather than a message. */
export function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

/** Adapt the conversation's reaction events into the shared `VoteEvent` shape the pure tally helpers consume. Only schema:'custom' reactions are votes. */
function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({ reference: p.reactTo, content: p.emoji, schema: 'custom', removed: !!p.removed, voter: e.from, ts: e.ts });
  }
  return out;
}

/** Poll message ids → normalized `PollQuestion[]` (legacy single-question polls fold to a one-element array; option strings coerce to {label}). The single source of truth the vote tally + isPollVote use to reason about a poll. */
export function pollQuestionsInFeed(events: HistoryEntry[]): Map<string, PollQuestion[]> {
  const out = new Map<string, PollQuestion[]>();
  for (const e of events) {
    const p = e.payload as { contentType?: string; poll?: PollContent } | undefined;
    if (p?.contentType !== 'poll' || !p.poll) continue;
    const qs = normalizeQuestions(p.poll);
    if (qs.length > 0) out.set(e.id, qs);
  }
  return out;
}

/** Poll message ids → q0 option count. Used by isPollVote to tell a bare-integer vote (legacy / question-0 form) from a genuine emoji reaction on a poll. */
export function pollOptionCountsInFeed(events: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, qs] of pollQuestionsInFeed(events)) {
    const q0 = qs[0];
    if (q0 !== undefined) out.set(id, q0.options.length);
  }
  return out;
}

/** Build `pollMessageId -> (questionIndex -> (optionIndex -> Set<voterUri>))` for every poll in the feed. Each question is tallied independently with its own multiSelect rule; the vote key (q, o) is decoded by the shared tally. */
export function votesByMessage(events: HistoryEntry[]): Map<string, Map<number, Map<number, Set<string>>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Map<number, Set<string>>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Map<number, Set<string>>>();
    qs.forEach((q, qi) => byQ.set(qi, tallyVotes(voteEvents, pollId, q.multiSelect === true, qi)));
    out.set(pollId, byQ);
  }
  return out;
}

/** Option indices the local user has selected, per poll then per question. */
export function ownVotesByMessage(events: HistoryEntry[], myUri: string): Map<string, Map<number, Set<number>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Set<number>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Set<number>>();
    qs.forEach((q, qi) => byQ.set(qi, tallyOwnVotes(voteEvents, myUri, pollId, q.multiSelect === true, qi)));
    out.set(pollId, byQ);
  }
  return out;
}

/** Free-text (open) answers per poll then per question: pollId -> (questionIndex -> (voterUri -> {text, ts})). Mirrors votesByMessage for the open-question path. Only questions flagged `open` are tallied. */
export function openAnswersByMessage(
  events: HistoryEntry[],
): Map<string, Map<number, Map<string, { text: string; ts: string }>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Map<string, { text: string; ts: string }>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Map<string, { text: string; ts: string }>>();
    qs.forEach((q, qi) => { if (q.open) byQ.set(qi, tallyOpenAnswers(voteEvents, pollId, qi)); });
    if (byQ.size > 0) out.set(pollId, byQ);
  }
  return out;
}

/** Short text/attachment preview of an entry — used for reply slabs + cache rows. */
export function previewOf(e: HistoryEntry): string {
  return (e.text ? humanizeMentions(e.text).slice(0, 80) : '')
    || (() => {
      const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
      return attachmentEmojiPreview(a?.mime, a?.name);
    })();
}
