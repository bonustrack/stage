/**
 * @file Proposals.queue — the pure (no-React) pending-request detector that folds
 *  poll, payment, signing and message-request kinds into one newest-first queue,
 *  reading each channel's tail from the local-first feed cache with bounded concurrency.
 */

import {
  loadFeedFirstPage, lineOfConv, listRequestConvs,
  summarizeConversationRequest, type CachedRow, type ConversationRequestView,
} from '../../modules/messaging';
import { pollOf, txRequestOf, sigRequestOf } from '../MessengerBubble.helpers';
import { isArchived } from '../../lib/archived';

/** The kind of pending request - drives which card the screen renders. */
export type RequestKind = 'poll' | 'payment' | 'signing' | 'message';

/** One queued pending request. `convId` + `ts` are common; the message-level kinds (poll/payment/signing) carry `msgId` (the latest message's id); the channel-level `message` kind carries the summarized request view. */
export interface QueuedRequest {
  /** Stable per-item key (`kind:convId`) - used as the session-skip key and the React list key. One channel yields at most one item, so this is unique. */
  key: string;
  kind: RequestKind;
  convId: string;
  /** Latest-message id for poll/payment/signing; undefined for message requests. */
  msgId?: string;
  /** Summarized request channel (name + preview + avatar) for `message` kind. */
  request?: ConversationRequestView;
  /** Sort key (ms epoch), newest-first. */
  ts: number;
}

/**
 * Detect the single message-level pending request in a channel, if any. The
 *  feed is newest-first, so `events[0]` is the latest message; a poll / payment /
 *  signing request there satisfies the "latest message of a channel" rule.
 *  Never throws (a feed-load failure just means "nothing pending here").
 */
async function detectOne(convId: string): Promise<QueuedRequest | null> {
  try {
    const events = await loadFeedFirstPage(lineOfConv(convId));
    const latest = events[0];
    if (!latest) return null;
    const ts = latest.ts ? new Date(latest.ts).getTime() : 0;
    if (pollOf(latest)) return { key: `poll:${convId}`, kind: 'poll', convId, msgId: latest.id, ts };
    if (txRequestOf(latest)) return { key: `payment:${convId}`, kind: 'payment', convId, msgId: latest.id, ts };
    if (sigRequestOf(latest)) return { key: `signing:${convId}`, kind: 'signing', convId, msgId: latest.id, ts };
    return null;
  } catch {
    return null;
  }
}

/** Run `tasks` with at most `limit` in flight at once. Order of results is not significant (the caller sorts), so this is a simple worker-pool drain. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      if (item === undefined) continue;
      out[idx] = await fn(item);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Detect the message-request (consent-unknown) channels and summarize each into a queued item. Best-effort: a listing/summarize failure yields no items. */
async function detectMessageRequests(): Promise<QueuedRequest[]> {
  try {
    const convs = await listRequestConvs();
    const summarized = await Promise.all(convs.map(async (conv): Promise<QueuedRequest | null> => {
      try {
        const view = await summarizeConversationRequest(conv);
        /** Order requests against the other kinds by their latest activity; the conv's `lastMessage` time when available, else now (newest). */
        const ts = await requestTs(conv);
        return { key: `message:${view.convId}`, kind: 'message', convId: view.convId, request: view, ts };
      } catch {
        return null;
      }
    }));
    return summarized.filter((r): r is QueuedRequest => r !== null);
  } catch {
    return [];
  }
}

/** Best-effort latest-activity time (ms) for a request conversation, used only to position it in the newest-first queue. Falls back to 0 (oldest) so a request with no resolvable time sorts to the back rather than crowding the front. */
async function requestTs(conv: unknown): Promise<number> {
  try {
    const last = await (conv as { lastMessage?: () => Promise<{ sentAtNs?: number } | null> }).lastMessage?.();
    const ns = last?.sentAtNs;
    if (typeof ns === 'number' && ns > 0) return Math.floor(ns / 1_000_000);
  } catch { /* ignore */ }
  return 0;
}

/**
 * Build the newest-first pending-request queue. Message-level kinds come from
 *  the channels-list rows (archived ones skipped per "all my non-archived chat");
 *  message requests come from the consent-unknown inbox. The two sources never
 *  overlap (allowed-only cache vs unknown-only requests).
 */
export async function buildProposalQueue(rows: CachedRow[]): Promise<QueuedRequest[]> {
  const candidates = rows.map(r => r.convId).filter(id => !isArchived(id));
  const [detected, messageReqs] = await Promise.all([
    mapLimit(candidates, 6, detectOne),
    detectMessageRequests(),
  ]);
  return [...detected.filter((p): p is QueuedRequest => p !== null), ...messageReqs]
    .sort((a, b) => b.ts - a.ts);
}
