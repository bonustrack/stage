/** @file TanStack-Query bridge for the in-channel message feed: feedCache stays the live-write source of truth while a single global subscription mirrors every slice write into the shared query cache, so the open feed renders from useQuery and gets live appends without diverging from the channels-list preview. */

import { getQueryClient } from '../../lib/queryClient';
import { getAccountEpoch } from '../../lib/accountEpoch';
import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { feedCache } from '../../lib/xmtp.state';
import { syncInboxOnce, PAGE_SIZE } from '../../lib/xmtp.stream';
import { messagingKeys } from './queries';
import { reconcileOnOpen } from './feedReconcile';

/** Mirror a feedCache slice into the query cache for `line` at the CURRENT account epoch. Called from the global feedCache subscription so the query cache tracks feedCache 1:1 (live append, initial load, older pages, resync). */
function mirrorSlice(line: string, slice: HistoryEntry[] | undefined): void {
  const key = messagingKeys.messages(getAccountEpoch(), line);
  getQueryClient().setQueryData<HistoryEntry[]>(key, slice ?? []);
}

let bridgeStarted = false;
/** Start the one global feedCache→query mirror. Idempotent + lazy: the first feed query (or the conversation screen) calls it. */
export function ensureFeedQueryBridge(): void {
  if (bridgeStarted) return;
  bridgeStarted = true;
  feedCache.subscribeAll((line, slice) => { mirrorSlice(line, slice); });
}

/** Drop control DMs + dedupe by id, preserving newest-first order. */
function mergeNewestFirst(prev: HistoryEntry[], additions: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set(prev.map(e => e.id));
  const fresh = additions.filter(e => !isMetroControlBody(e.text) && !seen.has(e.id));
  return fresh.length === 0 ? prev : [...fresh, ...prev];
}

/** Append a fetched page of raw XMTP messages into `feedCache` for `line` (newest-first, deduped, control DMs dropped via `mergeNewestFirst`). */
function applyPage(line: string, msgs: Parameters<typeof envelopeOfXmtpMessage>[0][]): void {
  const prev = feedCache.get(line) ?? [];
  const next = mergeNewestFirst(prev, msgs.map(m => envelopeOfXmtpMessage(m, line)));
  if (next !== prev) feedCache.set(line, next);
}

/** Coalesce concurrent background-syncs per line so a row-tap prefetch + the mount-time query don't fire two inbox-wide syncs for the same conversation. */
const bgSyncInFlight = new Map<string, Promise<void>>();

/** Background catch-up for an already-painted feed: force the inbox-wide sync (#375, maxAge 0), re-acquire the conversation handle AFTER the sync, and re-read the true tail through `feedCache` so the feed revalidates without the screen waiting on the network. */
function revalidateFeed(line: string): Promise<void> {
  const existing = bgSyncInFlight.get(line);
  if (existing) return existing;
  const run = (async (): Promise<void> => {
    try {
      await syncInboxOnce(0);
      const fresh = await convOfLine(line);
      if (!fresh) return;
      await fresh.sync().catch(() => undefined);
      applyPage(line, await fresh.messages({ limit: PAGE_SIZE }));
      /** OPEN-TIME EXACTNESS NET: assert the painted feed tail matches the conv's true latest (the channels-row preview's source); on mismatch it busts + reloads the slice, guarding the "preview shows it, open feed doesn't" desync. */
      await reconcileOnOpen(line);
    } catch { /* best-effort - the next open / resync retries */ }
    finally { bgSyncInFlight.delete(line); }
  })();
  bgSyncInFlight.set(line, run);
  return run;
}

/** Load a conversation's first page into `feedCache` and return it LOCAL-FIRST and NON-BLOCKING: paint the local MLS db and return immediately, while the inbox-wide catch-up (#375) runs in the background via `revalidateFeed` and streams in later through the mirror. */
export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) {
    /** No local handle yet (e.g. a brand-new request not in the local db): the inbox-wide sync is the only way to materialise it, so await it once. */
    await revalidateFeed(line);
    return feedCache.get(line) ?? [];
  }
  applyPage(line, await conv.messages({ limit: PAGE_SIZE }));
  void revalidateFeed(line);
  return feedCache.get(line) ?? [];
}

/** Warm a conversation's feed cache ahead of navigation so `useXmtpFeed`'s `initialData` seeds synchronously from the populated `feedCache` for an instant open with no loading flash; idempotent, cheap (TanStack dedupes by key), never throws. */
export function prefetchFeed(line: string): void {
  void getQueryClient()
    .prefetchQuery({
      queryKey: messagingKeys.messages(getAccountEpoch(), line),
      queryFn: () => loadFeedFirstPage(line),
      staleTime: 2_000,
    })
    .catch(() => undefined);
}

/** Fetch the next older page (scroll-up): events are newest-first so the oldest loaded event's `ts` reconstructs the ns cursor, and older messages append to the END through `feedCache`; returns true when a full page came back (more history may remain). */
export async function loadFeedOlderPage(line: string, oldest: HistoryEntry): Promise<boolean> {
  const conv = await convOfLine(line);
  if (!conv) return false;
  const beforeNs = new Date(oldest.ts).getTime() * 1_000_000;
  const older = await conv.messages({ limit: PAGE_SIZE, beforeNs, direction: 'DESCENDING' });
  const mapped = older
    .map(m => envelopeOfXmtpMessage(m, line))
    .filter(e => !isMetroControlBody(e.text));
  const prev = feedCache.get(line) ?? [];
  const seen = new Set(prev.map(e => e.id));
  const additions = mapped.filter(e => !seen.has(e.id));
  if (additions.length > 0) feedCache.set(line, [...prev, ...additions]);
  return mapped.filter(e => !prev.some(x => x.id === e.id)).length >= PAGE_SIZE;
}

