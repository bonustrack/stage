/** Pure feed-derivation helpers for the XMTP conversation screen — extracted
 *  from app/xmtp/[convId].tsx verbatim (phase-2 lint split). Behavior identical. */

import { votesByPoll as tallyVotes, ownVotes as tallyOwnVotes, type VoteEvent } from '@metro-labs/client/xmtp/poll';
import { stripMentionMarkup, attachmentEmojiPreview } from '@metro-labs/client/xmtp/humanize';
import type { HistoryEntry } from '../../lib/types';

/** Whether an entry carries attachments — used to dedup an optimistic
 *  attachment-only send (empty text) against its confirmed twin. */
export function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

/** True when a reaction is actually a poll VOTE (and so must not render as an
 *  emoji pill). A vote is either tagged `schema:'custom'`, or — for decode paths
 *  that drop the schema — a reaction on a poll bubble whose content is a pure
 *  non-negative integer that is a valid option index for that poll. A genuine
 *  emoji reaction on a poll (❤️, 👍, …) is NOT an integer, so it stays a pill. */
export function isPollVote(
  p: { reactTo?: string; emoji?: string; schema?: string } | undefined,
  pollOptionCounts: Map<string, number>,
): boolean {
  if (!p) return false;
  if (p.schema === 'custom') return true;
  if (!p.reactTo || !p.emoji) return false;
  const optionCount = pollOptionCounts.get(p.reactTo);
  if (optionCount === undefined) return false; // not a reaction on a poll
  if (!/^\d+$/.test(p.emoji)) return false; // a real emoji, not a bare index
  const idx = Number.parseInt(p.emoji, 10);
  return Number.isInteger(idx) && idx >= 0 && idx < optionCount;
}

/** Reaction events decorate their target msg — fold them into per-message,
 *  per-emoji counts rather than rendering as standalone bubbles. */
export function reactionsByMessage(events: HistoryEntry[], pollOptionCounts: Map<string, number>): Map<string, Map<string, number>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    /** Skip poll VOTES only — they're tallied separately by votesByPoll and would
     *  otherwise render as a "0"/"1"/"2" emoji pill. Genuine emoji reactions on a
     *  poll (❤️, 👍, …) must still render as pills. */
    if (isPollVote(p, pollOptionCounts)) continue;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji} ${e.from}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let m = out.get(msgId);
    if (!m) { m = new Map(); out.set(msgId, m); }
    m.set(emoji, (m.get(emoji) ?? 0) + 1);
  }
  return out;
}

/** Emojis the local user currently has on each message (latest add not undone by a
 *  later removal). Drives un-react: tapping an emoji you already own toggles it off. */
export function ownReactionsByMessage(events: HistoryEntry[], myUri: string, pollOptionCounts: Map<string, number>): Map<string, Set<string>> {
  const latest = new Map<string, { ts: string; removed: boolean }>();
  for (const e of events) {
    if (e.from !== myUri) continue;
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (isPollVote(p, pollOptionCounts)) continue;
    if (!p?.reactTo || !p.emoji) continue;
    const k = `${p.reactTo} ${p.emoji}`;
    const cur = latest.get(k);
    if (!cur || cur.ts < e.ts) latest.set(k, { ts: e.ts, removed: !!p.removed });
  }
  const out = new Map<string, Set<string>>();
  for (const [k, v] of latest) {
    if (v.removed) continue;
    const [msgId, emoji] = k.split(' ');
    let s = out.get(msgId);
    if (!s) { s = new Set(); out.set(msgId, s); }
    s.add(emoji);
  }
  return out;
}

export function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

/** Adapt the conversation's reaction events into the shared `VoteEvent` shape
 *  the pure tally helpers consume. Only schema:'custom' reactions are votes. */
export function voteEventsOf(events: HistoryEntry[]): VoteEvent[] {
  const out: VoteEvent[] = [];
  for (const e of events) {
    const p = e.payload as { reactTo?: string; emoji?: string; removed?: boolean; schema?: string } | undefined;
    if (p?.schema !== 'custom' || !p.reactTo || p.emoji === undefined) continue;
    out.push({ reference: p.reactTo, content: p.emoji, schema: 'custom', removed: !!p.removed, voter: e.from, ts: e.ts });
  }
  return out;
}

/** Poll message ids → option count, derived from the poll bubbles in the feed.
 *  Used to tell a vote (content = a valid option index) from a genuine emoji
 *  reaction on a poll, when the vote's `schema:'custom'` tag didn't survive decode. */
export function pollOptionCountsInFeed(events: HistoryEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of events) {
    const p = e.payload as { contentType?: string; poll?: { options?: unknown[] } } | undefined;
    if (p?.contentType === 'poll' && Array.isArray(p.poll?.options)) out.set(e.id, p.poll.options.length);
  }
  return out;
}

/** Poll message ids → multiSelect flag, derived from the poll bubbles in the feed
 *  (single-select tallies dedupe differently than multi). */
export function pollsInFeed(events: HistoryEntry[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const e of events) {
    const p = e.payload as { contentType?: string; poll?: { multiSelect?: boolean } } | undefined;
    if (p?.contentType === 'poll' && p.poll) out.set(e.id, p.poll.multiSelect === true);
  }
  return out;
}

/** Build `pollMessageId → (optionIndex → Set<voterUri>)` for every poll in the feed. */
export function votesByMessage(events: HistoryEntry[]): Map<string, Map<number, Set<string>>> {
  const polls = pollsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Map<number, Set<string>>>();
  for (const [pollId, multi] of polls) out.set(pollId, tallyVotes(voteEvents, pollId, multi));
  return out;
}

/** Option indices the local user has selected, per poll message id. */
export function ownVotesByMessage(events: HistoryEntry[], myUri: string): Map<string, Set<number>> {
  const polls = pollsInFeed(events);
  if (polls.size === 0) return new Map();
  const voteEvents = voteEventsOf(events);
  const out = new Map<string, Set<number>>();
  for (const [pollId, multi] of polls) out.set(pollId, tallyOwnVotes(voteEvents, myUri, pollId, multi));
  return out;
}

/** Short text/attachment preview of an entry — used for reply slabs + cache rows. */
export function previewOf(e: HistoryEntry): string {
  return (e.text ? stripMentionMarkup(e.text).slice(0, 80) : '')
    || (() => {
      const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
      return attachmentEmojiPreview(a?.mime, a?.name);
    })();
}
