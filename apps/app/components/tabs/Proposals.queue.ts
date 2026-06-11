/** Proposal-queue detection for the Proposals tab.
 *
 *  Scans every NON-ARCHIVED conversation and queues the ones whose LATEST
 *  message is a poll (the `metro.box/poll:1.0` custom content type, surfaced in
 *  the feed by `pollOf`). The queue is ordered OLDEST-poll-first so Less works
 *  through pending proposals chronologically (matches the spec: "from the oldest
 *  to the newest").
 *
 *  Detection rides the existing local-first feed loader (`loadFeedFirstPage`),
 *  so each channel's tail is read from the same TanStack/feedCache the chat view
 *  uses - no extra network beyond what the channels list already synced. We only
 *  inspect the newest event per channel (`events[0]`, the feed is newest-first).
 *
 *  Pure data layer (no React) so it's unit-testable and the screen hook stays
 *  thin. Concurrency is bounded so opening the tab doesn't fan out N parallel
 *  feed loads on a large inbox. */

import { loadFeedFirstPage, lineOfConv, type CachedRow } from '../../modules/messaging';
import { pollOf } from '../MessengerBubble.helpers';
import { isArchived } from '../../lib/archived';

/** One queued proposal: the channel it lives in + the poll message's send time
 *  (ms epoch) used to order the queue oldest-first. */
export interface QueuedProposal {
  convId: string;
  /** Poll message id (the latest message's id). */
  pollMsgId: string;
  /** Poll send time, ms epoch — queue sort key (oldest first). */
  ts: number;
}

/** Resolve a single channel: is its LATEST message a poll? Returns the queued
 *  entry or null. Never throws (a feed-load failure just means "no poll here").
 *  The feed is newest-first, so `events[0]` is the latest message; a poll there
 *  satisfies the spec's "only show poll if its the latest message of a channel". */
async function detectOne(convId: string): Promise<QueuedProposal | null> {
  try {
    const events = await loadFeedFirstPage(lineOfConv(convId));
    const latest = events[0];
    if (!latest) return null;
    const poll = pollOf(latest);
    if (!poll) return null;
    const ts = latest.ts ? new Date(latest.ts).getTime() : 0;
    return { convId, pollMsgId: latest.id, ts };
  } catch {
    return null;
  }
}

/** Run `tasks` with at most `limit` in flight at once. Order of results is not
 *  significant (the caller sorts), so this is a simple worker-pool drain. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Build the oldest-first proposal queue from the channels-list rows. Rows that
 *  are archived (device-local) are skipped per the spec ("all my non-archived
 *  chat"). */
export async function buildProposalQueue(rows: CachedRow[]): Promise<QueuedProposal[]> {
  const candidates = rows.map(r => r.convId).filter(id => !isArchived(id));
  const detected = await mapLimit(candidates, 6, detectOne);
  return detected
    .filter((p): p is QueuedProposal => p !== null)
    .sort((a, b) => a.ts - b.ts);
}
