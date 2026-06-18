/** Pending-request detection for the Pending requests page.
 *
 *  Scans for FOUR kinds of pending request and folds them into one newest-first
 *  queue (most recent requests surface at the top of the queue):
 *
 *   1. POLLS    - a non-archived channel whose LATEST message is a poll
 *                 (`pollOf`). Latest-message rule, as the original tab shipped.
 *   2. PAYMENTS - a non-archived channel whose LATEST message is a walletSendCalls
 *                 payment request (`txRequestOf`). "Latest" already encodes
 *                 "unpaid": once paid, the TxReference receipt becomes the latest
 *                 message and the request drops out.
 *   3. SIGNING  - a non-archived channel whose LATEST message is a signatureRequest
 *                 (`sigRequestOf`). Same latest = unsigned logic (the
 *                 SignatureReference receipt would be latest once signed).
 *   4. MESSAGE  - a conversation whose consent is `'unknown'` (the message-request
 *                 inbox). These are CHANNEL-level, not message-level, so they come
 *                 from `listRequestConvs()` + `summarizeConversationRequest`, not
 *                 the latest-message scan. Consent-unknown convs are NOT in the
 *                 channels-list cache (allowed-only), so they never double-count
 *                 against the message-level kinds.
 *
 *  Detection for kinds 1-3 rides the existing local-first feed loader
 *  (`loadFeedFirstPage`) - each channel's tail is read from the same feedCache
 *  the chat view uses, so no extra network beyond what the channels list synced.
 *  We only inspect the newest event per channel (`events[0]`, newest-first).
 *
 *  Pure data layer (no React) so the screen hook stays thin. Concurrency is
 *  bounded so opening the page doesn't fan out N parallel feed loads. */

import {
  loadFeedFirstPage, lineOfConv, listRequestConvs,
  summarizeConversationRequest, type CachedRow, type ConversationRequestView,
} from '../../modules/messaging';
import { pollOf, txRequestOf, sigRequestOf } from '../MessengerBubble.helpers';
import { isArchived } from '../../lib/archived';

/** The kind of pending request - drives which card the screen renders. */
export type RequestKind = 'poll' | 'payment' | 'signing' | 'message';

/** One queued pending request. `convId` + `ts` are common; the message-level
 *  kinds (poll/payment/signing) carry `msgId` (the latest message's id);
 *  the channel-level `message` kind carries the summarized request view. */
export interface QueuedRequest {
  /** Stable per-item key (`kind:convId`) - used as the session-skip key and the
   *  React list key. One channel yields at most one item, so this is unique. */
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

/** Detect the single message-level pending request in a channel, if any. The
 *  feed is newest-first, so `events[0]` is the latest message; a poll / payment /
 *  signing request there satisfies the "latest message of a channel" rule.
 *  Never throws (a feed-load failure just means "nothing pending here"). */
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

/** Detect the message-request (consent-unknown) channels and summarize each into
 *  a queued item. Best-effort: a listing/summarize failure yields no items. */
async function detectMessageRequests(): Promise<QueuedRequest[]> {
  try {
    const convs = await listRequestConvs();
    const summarized = await Promise.all(convs.map(async (conv): Promise<QueuedRequest | null> => {
      try {
        const view = await summarizeConversationRequest(conv);
        /** Order requests against the other kinds by their latest activity; the
         *  conv's `lastMessage` time when available, else now (newest). */
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

/** Best-effort latest-activity time (ms) for a request conversation, used only to
 *  position it in the newest-first queue. Falls back to 0 (oldest) so a request
 *  with no resolvable time sorts to the back rather than crowding the front. */
async function requestTs(conv: unknown): Promise<number> {
  try {
    const last = await (conv as { lastMessage?: () => Promise<{ sentAtNs?: number } | null> }).lastMessage?.();
    const ns = last?.sentAtNs;
    if (typeof ns === 'number' && ns > 0) return Math.floor(ns / 1_000_000);
  } catch { /* ignore */ }
  return 0;
}

/** Build the newest-first pending-request queue. Message-level kinds come from
 *  the channels-list rows (archived ones skipped per "all my non-archived chat");
 *  message requests come from the consent-unknown inbox. The two sources never
 *  overlap (allowed-only cache vs unknown-only requests). */
export async function buildProposalQueue(rows: CachedRow[]): Promise<QueuedRequest[]> {
  const candidates = rows.map(r => r.convId).filter(id => !isArchived(id));
  const [detected, messageReqs] = await Promise.all([
    mapLimit(candidates, 6, detectOne),
    detectMessageRequests(),
  ]);
  return [...detected.filter((p): p is QueuedRequest => p !== null), ...messageReqs]
    .sort((a, b) => b.ts - a.ts);
}
