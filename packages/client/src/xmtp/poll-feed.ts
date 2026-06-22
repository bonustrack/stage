
import type { HistoryEntry } from '../types';
import { votesByPoll, ownVotes, openAnswersByPoll, type VoteEvent } from './poll-tally';
import { normalizeQuestions, type PollContent, type PollQuestion } from './poll';

interface VotePayload {
  reactTo?: string;
  emoji?: string;
  removed?: boolean;
  schema?: string;
}

interface PollPayload {
  contentType?: string;
  poll?: PollContent;
}

export function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as VotePayload | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({
      reference: p.reactTo, content: p.emoji, schema: 'custom',
      removed: !!p.removed, voter: e.from, ts: e.ts,
    });
  }
  return out;
}

export function pollQuestionsInFeed(events: HistoryEntry[]): Map<string, PollQuestion[]> {
  const out = new Map<string, PollQuestion[]>();
  for (const e of events) {
    const p = e.payload as PollPayload | undefined;
    if (p?.contentType !== 'poll' || !p.poll) continue;
    const qs = normalizeQuestions(p.poll);
    if (qs.length > 0) out.set(e.id, qs);
  }
  return out;
}

export function pollOptionCountsInFeed(events: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, qs] of pollQuestionsInFeed(events)) {
    const q0 = qs[0];
    if (q0 !== undefined) out.set(id, q0.options.length);
  }
  return out;
}

export function votesByMessage(
  events: HistoryEntry[],
): Map<string, Map<number, Map<number, Set<string>>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Map<number, Set<string>>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Map<number, Set<string>>>();
    qs.forEach((q, qi) => byQ.set(qi, votesByPoll(voteEvents, pollId, q.multiSelect === true, qi)));
    out.set(pollId, byQ);
  }
  return out;
}

export function ownVotesByMessage(
  events: HistoryEntry[], myUri: string,
): Map<string, Map<number, Set<number>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Set<number>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Set<number>>();
    qs.forEach((q, qi) => byQ.set(qi, ownVotes(voteEvents, myUri, pollId, q.multiSelect === true, qi)));
    out.set(pollId, byQ);
  }
  return out;
}

export function openAnswersByMessage(
  events: HistoryEntry[],
): Map<string, Map<number, Map<string, { text: string; ts: string }>>> {
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Map<string, { text: string; ts: string }>>>();
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, Map<string, { text: string; ts: string }>>();
    qs.forEach((q, qi) => { if (q.open) byQ.set(qi, openAnswersByPoll(voteEvents, pollId, qi)); });
    if (byQ.size > 0) out.set(pollId, byQ);
  }
  return out;
}
