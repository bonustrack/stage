
import { humanizeMentions, attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from '@stage-labs/client/types';

export {
  pollOptionCountsInFeed, pollQuestionsInFeed,
  votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from '@stage-labs/client/xmtp/poll-feed';

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

export interface FeedScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

export function feedDistanceFromNewest(m: FeedScrollMetrics, upright: boolean): number {
  if (!upright) return Math.max(0, m.offset);
  return Math.max(0, m.contentHeight - m.viewportHeight - m.offset);
}

export function uprightScrollOffset(
  distanceFromNewest: number, contentHeight: number, viewportHeight: number,
): number {
  return Math.max(0, contentHeight - viewportHeight - distanceFromNewest);
}

export function planUprightRestore(args: {
  loaded: boolean; restoredSaved: boolean; savedDistance: number | undefined;
  userDragged: boolean; atNewest: boolean;
}): 'saved' | 'newest' | 'skip' {
  const { loaded, restoredSaved, savedDistance, userDragged, atNewest } = args;
  if (!loaded) return 'skip';
  if (!restoredSaved && savedDistance != null && savedDistance > 0) return 'saved';
  if (atNewest) return 'newest';
  return userDragged || restoredSaved ? 'skip' : 'newest';
}

export function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

export function previewOf(e: HistoryEntry): string {
  return (e.text ? humanizeMentions(e.text).slice(0, 80) : '')
    || (() => {
      const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
      return attachmentEmojiPreview(a?.mime, a?.name);
    })();
}
