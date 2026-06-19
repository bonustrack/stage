/** OPEN-FEED EXACTNESS RECONCILER (event-driven, zero timers).
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  THE BUG (Less's repro): "I see the message in the Home row preview, but when
 *  I open the channel it isn't there." The message IS in the local XMTP store
 *  (the channels-list reducer rendered it straight off the live stream by matching
 *  the row's convId), but the OPEN feed - which renders from `feedCache.get(line)`
 *  mirrored into the TanStack query cache - kept a stale tail. That happens when
 *  the live `pushToFeedSlice` write and the open-time `revalidateFeed` read race
 *  the late inbox sync (MLS commit ordering): the feed's slice never gets the
 *  just-arrived tail, and nothing re-reads it, so the open conversation silently
 *  lags the row preview.
 *
 *  THE NET (this module): make the two surfaces converge by EVENT, not by poll.
 *    - OPEN time: after the local paint + background revalidate, assert
 *      feed-latest == store-latest (same source the row preview uses:
 *      `conv.messages({limit:1})`). On mismatch, bust the stale slice + reload.
 *    - ARRIVAL time: when a message arrives for the currently-open conv and it is
 *      NOT the direct successor of the feed's latest (a `sentNs` gap), do one
 *      targeted `conv.sync()` + slice reload so the gap is filled.
 *  Both heal through `feedCache` -> the mirror -> the query cache -> the channels
 *  preview, so a single pass converges every surface. A breadcrumb is logged when
 *  divergence is detected + healed so Less's reports become verifiable in logs.
 *  ─────────────────────────────────────────────────────────────────────────── */

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

/** `sentNs` for a HistoryEntry. The envelope carries `ts` (ISO ms); reconstruct
 *  ns so feed-latest and store-latest compare on the same axis the stream uses. */
function entryNs(e: HistoryEntry): number {
  const ms = new Date(e.ts).getTime();
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

/** Merge a freshly-read first page into `line`'s slice, newest-first + deduped,
 *  control-DMs dropped. MERGE (not wholesale replace) so older pages the user
 *  already scrolled in are preserved - only the missing newer tail is folded in
 *  ahead of the existing slice. This is the heal write for both reconcilers. */
function reloadSlice(line: string, msgs: HistoryEntry[]): void {
  const page = msgs.filter(e => !isMetroControlBody(e.text));
  const prev = feedCache.get(line) ?? [];
  const seen = new Set(prev.map(e => e.id));
  const fresh = page.filter(e => !seen.has(e.id));
  if (fresh.length === 0) return;
  /** Page is newest-first; existing slice is newest-first. New tail entries are
   *  all newer than the current head (a gap heal), so prepend them. */
  feedCache.set(line, [...fresh, ...prev]);
}

/** OPEN-TIME EXACTNESS. Called after the background open-sync settled. Compares
 *  the feed's latest entry against the conv's true latest (`conv.messages` limit
 *  1 - the same source the channels-list preview reads). If they differ (the
 *  preview is ahead of the open feed), bust + reload the slice from the local
 *  store. Best-effort + idempotent; safe to call repeatedly. */
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
    /** Divergence: the store has a newer (or different) tail than the open feed.
     *  Reload the full first page from the now-synced local store. */
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

/** ARRIVAL CONTINUITY. Called from the global stream right after a message was
 *  pushed into `line`'s slice. The arriving message SHOULD now be the feed's
 *  latest (the push prepends newest-first). When it ISN'T - the push was a
 *  no-op because the slice was keyed elsewhere, or the feed's tail is somehow
 *  behind the arriving message - that's the desync signal: do one targeted
 *  `conv.sync()` + slice reload so the open feed catches the message the row
 *  preview already shows. `prevLatestNs` is the feed-latest ns BEFORE the push;
 *  `arrivingId` is the message that just arrived. No-op when contiguous. */
export async function reconcileOnArrival(
  line: string, prevLatestNs: number, arrivingNs: number, arrivingId: string,
): Promise<void> {
  if (!activeFeedLines.has(line)) return;
  /** Healthy path: the push made the arriving message the feed's latest AND it
   *  is at-or-after the prior tail (forward, contiguous). Nothing to heal. */
  const latestNow = feedLatest(line);
  if (latestNow?.id === arrivingId && arrivingNs >= prevLatestNs) return;
  /** Desync: the arriving message did NOT become the visible tail (push landed
   *  on a different key, or an older slice is masking it). Reload from store. */
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

/** Synchronous feed-latest ns for `line` - used by the stream to capture the
 *  pre-push tail so `reconcileOnArrival` can detect a gap. */
export function feedLatestNs(line: string): number {
  const e = feedLatest(line);
  return e ? entryNs(e) : 0;
}
