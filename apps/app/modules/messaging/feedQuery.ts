/** TanStack-Query bridge for the in-channel message feed.
 *
 *  ───────────────────────────────────────────────────────────────────────────
 *  WHY (the desync class, structurally)
 *
 *  The in-channel feed and the channels-list last-message preview historically
 *  read from two different stores: the feed off `feedCache` (a MemoryStore the
 *  global stream writes through `pushToFeedSlice`), the list off its own
 *  `setRows` reducer (HomeScreen.stream). They could diverge - the list bumped a
 *  row off the live stream while the open feed missed the same message (the bug
 *  #375 patched at open-time with a forced inbox sync + handle re-acquire).
 *
 *  This module makes the OPEN feed react-query-backed. `feedCache` stays the
 *  live-write source of truth (the global stream / resync backstop / pagination
 *  all write it - that plumbing is battle-tested against the XMTP read-rate
 *  limit). A single global subscription mirrors every `feedCache` slice write
 *  into the shared TanStack query cache under `messagingKeys.messages(epoch,
 *  line)`, so the open feed renders from `useQuery` over that key and gets live
 *  appends for free via the mirror. This bridge serves the open feed ONLY; the
 *  channels-list last-message preview still comes from HomeScreen.stream.ts via
 *  `channelsCache`.
 *
 *  The feed/list desync (#375) is prevented elsewhere: the topic-first convId
 *  resolution + `resyncActiveFeeds` path keeps both surfaces converged. The
 *  query's `queryFn` also folds in a sync-on-open step (force `syncInboxOnce(0)`
 *  + re-acquire the conversation handle after the inbox-wide sync) so opening a
 *  conv catches up the just-arrived message the channels list rendered straight
 *  off the live stream.
 *  ─────────────────────────────────────────────────────────────────────────── */

import { getQueryClient } from '../../lib/queryClient';
import { getAccountEpoch } from '../../lib/accountEpoch';
import type { HistoryEntry } from '../../lib/types';
import { isMetroControlBody } from '../../lib/push';
import { convOfLine } from '../../lib/xmtp.client';
import { envelopeOfXmtpMessage } from '../../lib/xmtp.messages';
import { feedCache } from '../../lib/xmtp.state';
import { syncInboxOnce, PAGE_SIZE } from '../../lib/xmtp.stream';
import { beginSync } from '../../lib/syncStatus';
import { messagingKeys } from './queries';

/** Mirror a feedCache slice into the query cache for `line` at the CURRENT
 *  account epoch. Called from the global feedCache subscription so the query
 *  cache tracks feedCache 1:1 (live append, initial load, older pages, resync). */
function mirrorSlice(line: string, slice: HistoryEntry[] | undefined): void {
  const key = messagingKeys.messages(getAccountEpoch(), line);
  getQueryClient().setQueryData<HistoryEntry[]>(key, slice ?? []);
}

let bridgeStarted = false;
/** Start the one global feedCache→query mirror. Idempotent + lazy: the first
 *  feed query (or the conversation screen) calls it. */
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

/** Append a fetched page of raw XMTP messages into `feedCache` for `line`
 *  (newest-first, deduped, control DMs dropped via `mergeNewestFirst`). */
function applyPage(line: string, msgs: Parameters<typeof envelopeOfXmtpMessage>[0][]): void {
  const prev = feedCache.get(line) ?? [];
  const next = mergeNewestFirst(prev, msgs.map(m => envelopeOfXmtpMessage(m, line)));
  if (next !== prev) feedCache.set(line, next);
}

/** Coalesce concurrent background-syncs per line so a row-tap prefetch + the
 *  mount-time query don't fire two inbox-wide syncs for the same conversation. */
const bgSyncInFlight = new Map<string, Promise<void>>();

/** Background catch-up for an already-painted feed: force the inbox-wide sync
 *  (#375: maxAge 0 - an explicit OPEN must not be short-circuited by
 *  `syncInboxOnce`'s freshness window), re-acquire the conversation handle AFTER
 *  the sync (the pre-sync handle's `.messages()` can lag the freshly-synced
 *  local DB) and re-read the true tail. Writes through `feedCache` so the global
 *  mirror updates the query cache + the channels-list preview - i.e. the open
 *  feed revalidates WITHOUT the screen ever waiting on the network round-trip. */
function revalidateFeed(line: string): Promise<void> {
  const existing = bgSyncInFlight.get(line);
  if (existing) return existing;
  /** Count the whole per-conv revalidation for the sync dot - the inbox sync
   *  inside is coalesced/freshness-windowed so on its own it may end instantly,
   *  but the per-conv `fresh.sync()` + tail re-read is the part the user is
   *  waiting on when they open a channel. One begin per revalidation pass,
   *  ended in `finally` the instant it settles. */
  const endSyncTrack = beginSync();
  const run = (async (): Promise<void> => {
    try {
      await syncInboxOnce(0);
      const fresh = await convOfLine(line);
      if (!fresh) return;
      await fresh.sync().catch(() => undefined);
      applyPage(line, await fresh.messages({ limit: PAGE_SIZE }));
    } catch { /* best-effort - the next open / resync retries */ }
    finally { bgSyncInFlight.delete(line); endSyncTrack(); }
  })();
  bgSyncInFlight.set(line, run);
  return run;
}

/** Load a conversation's first page into `feedCache` and return it. LOCAL-FIRST
 *  and NON-BLOCKING on the network: read the local MLS db, paint it, and return
 *  immediately so the screen opens from cache instantly (this is what made
 *  message-request opens slow - the queryFn used to `await syncInboxOnce(0)`
 *  before returning, and a request has no seeded feedCache slice so the feed sat
 *  on `loading` for the whole inbox-wide round-trip). The inbox-wide catch-up
 *  (#375) is kicked off in the BACKGROUND via `revalidateFeed`; its result lands
 *  through `feedCache` -> the mirror -> this query's cache, so any message that
 *  arrived while backgrounded streams in a beat later without blocking paint. */
export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) {
    /** No local handle yet (e.g. a brand-new request not in the local db): the
     *  inbox-wide sync is the only way to materialise it, so await it once. */
    await revalidateFeed(line);
    return feedCache.get(line) ?? [];
  }
  applyPage(line, await conv.messages({ limit: PAGE_SIZE }));
  void revalidateFeed(line);
  return feedCache.get(line) ?? [];
}

/** Warm a conversation's feed cache ahead of navigation (row tap / row mount).
 *  By the time the conversation screen mounts, `useXmtpFeed`'s `initialData`
 *  seeds synchronously from the now-populated `feedCache` -> instant open, no
 *  loading flash, no queryFn wait. Idempotent + cheap: TanStack dedupes the
 *  in-flight query by key, and the background revalidate is per-line coalesced.
 *  Never throws. */
export function prefetchFeed(line: string): void {
  void getQueryClient()
    .prefetchQuery({
      queryKey: messagingKeys.messages(getAccountEpoch(), line),
      queryFn: () => loadFeedFirstPage(line),
      staleTime: 2_000,
    })
    .catch(() => undefined);
}

/** Fetch the next older page (scroll-up). Events are newest-first, so the LAST
 *  loaded event is the oldest; its `ts` (ISO ms) reconstructs the ns cursor.
 *  Older messages APPEND to the END (still newest-first) through `feedCache`.
 *  Returns true when a full page came back (more history may remain). */
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

