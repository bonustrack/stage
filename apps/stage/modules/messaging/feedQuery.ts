import { getQueryClient } from '../../lib/queryClient';
import { getAccountEpoch } from '../../lib/accountEpoch';
import type { HistoryEntry } from '@stage-labs/client/types';
import { convOfLine, sdk } from '../../lib/xmtp.sdk';
import { isControlBody } from '../../lib/xmtp.types';
import { latestConvMessages, olderConvMessages } from '../../lib/xmtp.messages';
import {
  PAGE_SIZE, mergeLatestIntoFeed, mergePageIntoFeed, refreshLatestPage, syncInboxOnce,
} from '../../lib/xmtp.resync';
import { feedCache, activeFeedLines } from '../../lib/xmtp.state.core';
import { isFeedLoaded, markFeedLoaded, trackFirstPageLoad } from '../../lib/feedLines';
import { cachedFeed, rememberFeed } from '../../lib/feedSnapshot';
import { perfLog, perfTime } from '../../lib/perf';
import { messagingKeys } from './queries';
import { report, reported, recover, ignored } from '../../lib/errorPolicy';

function feedLatest(line: string): HistoryEntry | undefined {
  const slice = feedCache.get(line);
  if (!slice) return undefined;
  return slice.find(e => !isControlBody(e.text));
}

function entryNs(e: HistoryEntry): number {
  const ms = new Date(e.ts).getTime();
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

function logReconcileHeal(
  label: string, line: string, healedBy: string,
  before: HistoryEntry | undefined, after: { id: string | null; ts: string | null },
): void {
  console.log(
    label,
    JSON.stringify({
      line,
      feedLatestId: before?.id ?? null,
      feedLatestTs: before?.ts ?? null,
      storeLatestId: after.id,
      storeLatestTs: after.ts,
      healedBy,
    }),
  );
}

async function reconcileOnOpen(line: string): Promise<void> {
  const generation = feedCache.generation();
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    const [storeLatest] = await latestConvMessages(conv, line, 1);
    if (!storeLatest) return;
    if (isControlBody(storeLatest.text)) return;
    const feed = feedLatest(line);
    if (feed?.id === storeLatest.id) return;
    const page = await latestConvMessages(conv, line, PAGE_SIZE);
    if (generation !== feedCache.generation()) return;
    mergePageIntoFeed(line, page);
    logReconcileHeal('[feed-reconcile] open-time heal', line, 'reconcileOnOpen', feed, storeLatest);
  } catch (err) {
    report('feed.reconcileOnOpen', err);
  }
}

export async function reconcileOnArrival(
  line: string, prevLatestNs: number, arrivingNs: number, arrivingId: string,
): Promise<void> {
  if (!activeFeedLines.has(line)) return;
  const latestNow = feedLatest(line);
  if (latestNow?.id === arrivingId && arrivingNs >= prevLatestNs) return;
  await healArrivalGap(line);
}

async function healArrivalGap(line: string): Promise<void> {
  try {
    const page = await refreshLatestPage(line);
    if (!page) return;
    const before = feedLatest(line);
    mergePageIntoFeed(line, page);
    const after = feedLatest(line);
    if (before?.id !== after?.id) {
      logReconcileHeal(
        '[feed-reconcile] arrival-gap heal', line, 'reconcileOnArrival',
        before, { id: after?.id ?? null, ts: after?.ts ?? null },
      );
    }
  } catch (err) {
    report('feed.reconcileOnArrival', err);
  }
}

export function feedLatestNs(line: string): number {
  const e = feedLatest(line);
  return e ? entryNs(e) : 0;
}

function mirrorSlice(line: string, slice: HistoryEntry[] | undefined): void {
  if (!isFeedLoaded(line)) return;
  const key = messagingKeys.messages(getAccountEpoch(), line);
  getQueryClient().setQueryData<HistoryEntry[]>(key, slice ?? []);
}

function persistSlice(line: string, slice: HistoryEntry[] | undefined): void {
  if (slice === undefined || feedCache.cachedIds(line) !== undefined) return;
  rememberFeed(line, slice);
}

let bridgeStarted = false;
export function ensureFeedQueryBridge(): void {
  if (bridgeStarted) return;
  bridgeStarted = true;
  feedCache.subscribeAll((line, slice) => {
    mirrorSlice(line, slice);
    persistSlice(line, slice);
  });
}

const bgSyncInFlight = new Map<string, Promise<void>>();

function revalidateFeed(line: string, wholeInbox: boolean): Promise<void> {
  const generation = feedCache.generation();
  const key = `${generation}:${line}`;
  const existing = bgSyncInFlight.get(key);
  if (existing) return existing;
  const run = (async (): Promise<void> => {
    try {
      if (wholeInbox) await syncInboxOnce(0);
      const page = await refreshLatestPage(line);
      if (!page || generation !== feedCache.generation()) return;
      mergePageIntoFeed(line, page);
      await reconcileOnOpen(line);
    } catch (err) {
      report('feed.revalidate', err);
    } finally {
      bgSyncInFlight.delete(key);
    }
  })();
  bgSyncInFlight.set(key, run);
  return run;
}

async function loadFirstPage(line: string, generation: number): Promise<HistoryEntry[]> {
  const conv = await perfTime('feed.convOfLine', () => convOfLine(line));
  if (generation !== feedCache.generation()) return [];
  if (!conv) {
    perfLog('feed.coldPath: conversation not local, awaiting network');
    await perfTime('feed.revalidate', () => revalidateFeed(line, true));
    if (generation !== feedCache.generation()) return [];
    mergeLatestIntoFeed(line, []);
    markFeedLoaded(line);
    return feedCache.get(line) ?? [];
  }
  const page = await perfTime('feed.latestMessages', () => latestConvMessages(conv, line, PAGE_SIZE));
  if (generation !== feedCache.generation()) return [];
  mergePageIntoFeed(line, page);
  markFeedLoaded(line);
  void revalidateFeed(line, !sdk.isGroup(conv));
  return feedCache.get(line) ?? [];
}

async function showCachedFeed(line: string, generation: number): Promise<boolean> {
  if (feedCache.get(line) !== undefined) return false;
  const cached = await cachedFeed(line).catch(recover('feed.cached', null));
  if (generation !== feedCache.generation()) return false;
  if (!cached?.length || isFeedLoaded(line) || feedCache.get(line) !== undefined) return false;
  feedCache.showCached(line, cached);
  markFeedLoaded(line);
  perfLog('feed.cachedPage', { entries: cached.length });
  return true;
}

export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const generation = feedCache.generation();
  const latest = trackFirstPageLoad(loadFirstPage(line, generation));
  const cached = showCachedFeed(line, generation).then(shown => {
    if (!shown) return latest;
    void latest.catch(reported('feed.firstPage'));
    return feedCache.get(line) ?? [];
  });
  return Promise.race([latest, cached]);
}

export function prefetchFeed(line: string): void {
  void getQueryClient()
    .prefetchQuery({
      queryKey: messagingKeys.messages(getAccountEpoch(), line),
      queryFn: () => loadFeedFirstPage(line),
      staleTime: 2_000,
    })
    .catch(ignored(undefined, 'optional'));
}

export async function loadFeedOlderPage(line: string, oldest: HistoryEntry): Promise<void> {
  const beforeTsMs = new Date(oldest.ts).getTime();
  mergePageIntoFeed(line, await olderConvMessages(line, beforeTsMs, PAGE_SIZE), true);
}
