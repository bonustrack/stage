import type { HistoryEntry } from '../types';
import { votesByPoll, ownVotes, openAnswersByPoll, type VoteEvent } from './poll-tally';
import { normalizeQuestions, type PollQuestion } from './poll';
import { payloadTypeOf, pollContentOf, reactionOf } from './entryPayload';

function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = reactionOf(e);
    if (!p?.custom || !p.reactTo) continue;
    out.push({ reference: p.reactTo, content: p.emoji, schema: 'custom', removed: p.removed, voter: e.from, ts: e.ts });
  }
  return out;
}

export function pollQuestionsInFeed(events: HistoryEntry[]): Map<string, PollQuestion[]> {
  const out = new Map<string, PollQuestion[]>();
  for (const e of events) {
    const poll = payloadTypeOf(e) === 'poll' ? pollContentOf(e) : undefined;
    if (poll === undefined) continue;
    const qs = normalizeQuestions(poll);
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

function byPollQuestion<V>(
  events: HistoryEntry[],
  tally: (voteEvents: VoteEvent[], pollId: string, question: PollQuestion, questionIndex: number) => V | undefined,
): Map<string, Map<number, V>> {
  const out = new Map<string, Map<number, V>>();
  const polls = pollQuestionsInFeed(events);
  if (polls.size === 0) return out;
  const voteEvents = voteEventsOf(events);
  for (const [pollId, qs] of polls) {
    const byQ = new Map<number, V>();
    qs.forEach((q, qi) => {
      const value = tally(voteEvents, pollId, q, qi);
      if (value !== undefined) byQ.set(qi, value);
    });
    if (byQ.size > 0) out.set(pollId, byQ);
  }
  return out;
}

export function votesByMessage(events: HistoryEntry[]): Map<string, Map<number, Map<number, Set<string>>>> {
  return byPollQuestion(events, (votes, pollId, q, qi) => votesByPoll(votes, pollId, q.multiSelect === true, qi));
}

export function ownVotesByMessage(events: HistoryEntry[], myUri: string): Map<string, Map<number, Set<number>>> {
  return byPollQuestion(events, (votes, pollId, q, qi) => ownVotes(votes, myUri, pollId, q.multiSelect === true, qi));
}

export function openAnswersByMessage(events: HistoryEntry[]): Map<string, Map<number, Map<string, { text: string; ts: string }>>> {
  return byPollQuestion(events, (votes, pollId, q, qi) => (q.open ? openAnswersByPoll(votes, pollId, qi) : undefined));
}
