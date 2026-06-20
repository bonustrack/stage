
import {
  votesByPoll as tallyVotes, ownVotes as tallyOwnVotes,
  openAnswersByPoll as tallyOpenAnswers,
  normalizeQuestions, type VoteEvent, type PollContent, type PollQuestion,
} from '@stage-labs/client/xmtp/poll';
import { humanizeMentions, attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from '../../lib/types';

export function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

function isPollVote(
  p: { reactTo?: string; emoji?: string; schema?: string } | undefined,
  pollOptionCounts: Map<string, number>,
): boolean {
  if (!p) return false;
  if (p.schema === 'custom') return true;
  if (!p.reactTo || !p.emoji) return false;
  const optionCount = pollOptionCounts.get(p.reactTo);
  if (optionCount === undefined) return false;
  if (!/^\d+$/.test(p.emoji)) return false;
  const idx = Number.parseInt(p.emoji, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < optionCount;
}

interface ReactionPayload { reactTo: string; emoji: string; removed: boolean }

function reactionPayloadOf(e: HistoryEntry, pollOptionCounts: Map<string, number>): ReactionPayload | null {
  const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
  if (isPollVote(p, pollOptionCounts)) return null;
  if (!p?.reactTo || !p.emoji) return null;
  return { reactTo: p.reactTo, emoji: p.emoji, removed: !!p.removed };
}

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

export function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({ reference: p.reactTo, content: p.emoji, schema: 'custom', removed: !!p.removed, voter: e.from, ts: e.ts });
  }
  return out;
}

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

export function pollOptionCountsInFeed(events: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, qs] of pollQuestionsInFeed(events)) {
    const q0 = qs[0];
    if (q0 !== undefined) out.set(id, q0.options.length);
  }
  return out;
}

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

export function previewOf(e: HistoryEntry): string {
  return (e.text ? humanizeMentions(e.text).slice(0, 80) : '')
    || (() => {
      const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
      return attachmentEmojiPreview(a?.mime, a?.name);
    })();
}
