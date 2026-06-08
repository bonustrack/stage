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
 *  This module makes the feed react-query-backed and gives BOTH surfaces ONE
 *  cached source. `feedCache` stays the live-write source of truth (the global
 *  stream / resync backstop / pagination all write it - that plumbing is
 *  battle-tested against the XMTP read-rate limit). A single global subscription
 *  mirrors every `feedCache` slice write into the shared TanStack query cache
 *  under `messagingKeys.messages(epoch, line)`, so:
 *    - the open feed renders from `useQuery` over that key (live append for free
 *      via the mirror),
 *    - any consumer can read the latest cached message for a line off the SAME
 *      cache via `latestFeedMessage`,
 *  and a streamed message lands in both atomically.
 *
 *  The query's `queryFn` folds in #375's sync-on-open logic (force `syncInboxOnce(0)`
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

/** Load (or refresh) a conversation's first page into `feedCache`, returning the
 *  resulting slice. Local-first: paint the local MLS db immediately, then force
 *  the inbox-wide sync (#375: maxAge 0 - an explicit OPEN must not be
 *  short-circuited by `syncInboxOnce`'s freshness window) and re-acquire the
 *  conversation handle AFTER the sync (the pre-sync handle's `.messages()` can
 *  lag the freshly-synced local DB) before re-reading the true tail.
 *
 *  Writes through `feedCache` (the single live-write source of truth) so the
 *  global mirror keeps the query cache + the channels-list preview consistent. */
export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) return feedCache.get(line) ?? [];
  const apply = (msgs: Awaited<ReturnType<typeof conv.messages>>): void => {
    const prev = feedCache.get(line) ?? [];
    const next = mergeNewestFirst(prev, msgs.map(m => envelopeOfXmtpMessage(m, line)));
    if (next !== prev) feedCache.set(line, next);
  };
  const local = await conv.messages({ limit: PAGE_SIZE });
  apply(local);
  /** Catch-up: messages delivered while backgrounded / the conv was closed
   *  arrive via MLS group commits the native stream drops. Only the inbox-wide
   *  sync lands them (it's why the channels list saw the latest message this
   *  feed missed). FORCE it (maxAge 0) - see #375. */
  await syncInboxOnce(0);
  await conv.sync().catch(() => undefined);
  /** Re-acquire the handle AFTER the inbox-wide sync so `.messages()` reflects
   *  the freshly-synced local DB (#375). Fall back to the original handle. */
  const fresh = (await convOfLine(line)) ?? conv;
  apply(await fresh.messages({ limit: PAGE_SIZE }));
  return feedCache.get(line) ?? [];
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

/** The latest (newest) non-control message cached for a conversation line, read
 *  from the SAME query-mirrored feedCache the open feed renders. Lets the
 *  channels-list preview derive its last message from the shared source instead
 *  of a divergent path. Returns null when nothing is cached yet. */
export function latestFeedMessage(line: string): HistoryEntry | null {
  return feedCache.get(line)?.[0] ?? null;
}

