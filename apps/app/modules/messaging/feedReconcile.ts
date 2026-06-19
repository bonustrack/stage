/**
 * @file Event-driven (zero-timer) reconciler that converges the open feed with the local XMTP store, busting and reloading a stale feed slice when, at open time or on a gapped arrival, the feed latest disagrees with the store latest (the "message in the row preview but missing in the open channel" bug).
 */

import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { feedCache, activeFeedLines } from '../../lib/xmtp.state';
import { PAGE_SIZE } from '../../lib/xmtp.resync';

/** Newest non-control entry currently in the feed slice (newest-first order). */
function feedLatest(line: string): HistoryEntry | undefined {
  const slice = feedCache.get(line);
  if (!slice) return undefined;
  return slice.find(e => !isMetroControlBody(e.text));
}

/** `sentNs` for a HistoryEntry. The envelope carries `ts` (ISO ms); reconstruct ns so feed-latest and store-latest compare on the same axis the stream uses. */
function entryNs(e: HistoryEntry): number {
  const ms = new Date(e.ts).getTime();
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

/**
 * Merge a freshly-read first page into `line`'s slice, newest-first + deduped,
 *  control-DMs dropped. MERGE (not wholesale replace) so older pages the user
 *  already scrolled in are preserved - only the missing newer tail is folded in
 *  ahead of the existing slice. This is the heal write for both reconcilers.
 */
function reloadSlice(line: string, msgs: HistoryEntry[]): void {
  const page = msgs.filter(e => !isMetroControlBody(e.text));
  const prev = feedCache.get(line) ?? [];
  const seen = new Set(prev.map(e => e.id));
  const fresh = page.filter(e => !seen.has(e.id));
  if (fresh.length === 0) return;
  /** Page is newest-first; existing slice is newest-first. New tail entries are all newer than the current head (a gap heal), so prepend them. */
  feedCache.set(line, [...fresh, ...prev]);
}

/**
 * OPEN-TIME EXACTNESS. Called after the background open-sync settled. Compares
 *  the feed's latest entry against the conv's true latest (`conv.messages` limit
 *  1 - the same source the channels-list preview reads). If they differ (the
 *  preview is ahead of the open feed), bust + reload the slice from the local
 *  store. Best-effort + idempotent; safe to call repeatedly.
 */
export async function reconcileOnOpen(line: string): Promise<void> {
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    const [storeLatestMsg] = await conv.messages({ limit: 1 });
    if (!storeLatestMsg) return;
    const storeLatest = envelopeOfXmtpMessage(storeLatestMsg, line);
    if (isMetroControlBody(storeLatest.text)) return; // control DM, not a visible tail
    const feed = feedLatest(line);
    if (feed?.id === storeLatest.id) return; // converged - nothing to heal
    /** Divergence: the store has a newer (or different) tail than the open feed. Reload the full first page from the now-synced local store. */
    const page = await conv.messages({ limit: PAGE_SIZE });
    reloadSlice(line, page.map(m => envelopeOfXmtpMessage(m, line)));
    console.log(
      '[feed-reconcile] open-time heal',
      JSON.stringify({
        line,
        feedLatestId: feed?.id ?? null,
        feedLatestTs: feed?.ts ?? null,
        storeLatestId: storeLatest.id,
        storeLatestTs: storeLatest.ts,
        healedBy: 'reconcileOnOpen',
      }),
    );
  } catch { /* best-effort - next open / arrival retries */ }
}

/**
 * ARRIVAL CONTINUITY. Called from the global stream right after a message was
 *  pushed into `line`'s slice. The arriving message SHOULD now be the feed's
 *  latest (the push prepends newest-first). When it ISN'T - the push was a
 *  no-op because the slice was keyed elsewhere, or the feed's tail is somehow
 *  behind the arriving message - that's the desync signal: do one targeted
 *  `conv.sync()` + slice reload so the open feed catches the message the row
 *  preview already shows. `prevLatestNs` is the feed-latest ns BEFORE the push;
 *  `arrivingId` is the message that just arrived. No-op when contiguous.
 */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
export async function reconcileOnArrival(
  line: string, prevLatestNs: number, arrivingNs: number, arrivingId: string,
): Promise<void> {
  if (!activeFeedLines.has(line)) return;
  /** Healthy path: the push made the arriving message the feed's latest AND it is at-or-after the prior tail (forward, contiguous). Nothing to heal. */
  const latestNow = feedLatest(line);
  if (latestNow?.id === arrivingId && arrivingNs >= prevLatestNs) return;
  /** Desync: the arriving message did NOT become the visible tail (push landed on a different key, or an older slice is masking it). Reload from store. */
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    await conv.sync().catch(() => undefined);
    const page = await conv.messages({ limit: PAGE_SIZE });
    const mapped = page.map(m => envelopeOfXmtpMessage(m, line)).filter(e => !isMetroControlBody(e.text));
    const before = feedLatest(line);
    reloadSlice(line, mapped);
    const after = feedLatest(line);
    if (before?.id !== after?.id) {
      console.log(
        '[feed-reconcile] arrival-gap heal',
        JSON.stringify({
          line,
          feedLatestId: before?.id ?? null,
          feedLatestTs: before?.ts ?? null,
          storeLatestId: after?.id ?? null,
          storeLatestTs: after?.ts ?? null,
          healedBy: 'reconcileOnArrival',
        }),
      );
    }
  } catch { /* best-effort - next arrival / open retries */ }
}

/** Synchronous feed-latest ns for `line` - used by the stream to capture the pre-push tail so `reconcileOnArrival` can detect a gap. */
export function feedLatestNs(line: string): number {
  const e = feedLatest(line);
  return e ? entryNs(e) : 0;
}
