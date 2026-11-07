import { getQueryClient } from '../queryClient';
import { getAccountEpoch } from '../accountEpoch';
import type { HistoryEntry } from '@stage-labs/client/types';
import { sdk } from '../xmtp.sdk';
import { convOfLine } from '../xmtp.find';
import { latestConvMessages, olderConvMessages } from '../xmtp.messages';
import { PAGE_SIZE, mergeLatestIntoFeed, mergePageIntoFeed } from './merge';
import { refreshLatestPage, syncInboxOnce } from './resync';
import { feedCache, feedGeneration, type FeedGeneration } from './cache';
import { isFeedLoaded, markFeedLoaded, takeFreshFeed } from './lines';
import { trackFirstPageLoad } from './firstPages';
import { cachedFeed } from './snapshot';
import { reconcileOnOpen } from './heal';
import { feedQueryKey } from './query';
import { perfLog, perfTime } from '../perf';
import { report, reported, recover, ignored } from '../errorPolicy';

const bgSyncInFlight = new Map<string, Promise<void>>();

function revalidateFeed(line: string, wholeInbox: boolean): Promise<void> {
  const generation = feedGeneration();
  const key = `${generation.id}:${line}`;
  const existing = bgSyncInFlight.get(key);
  if (existing) return existing;
  const run = (async (): Promise<void> => {
    try {
      if (wholeInbox) await syncInboxOnce(0);
      const page = await refreshLatestPage(line);
      if (!page || !generation.current()) return;
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

async function loadFirstPage(line: string, generation: FeedGeneration): Promise<HistoryEntry[]> {
  const conv = await perfTime('feed.convOfLine', () => convOfLine(line));
  if (!generation.current()) return [];
  if (!conv) {
    perfLog('feed.coldPath: conversation not local, awaiting network');
    await perfTime('feed.revalidate', () => revalidateFeed(line, true));
    if (!generation.current()) return [];
    mergeLatestIntoFeed(line, []);
    markFeedLoaded(line);
    return feedCache.get(line) ?? [];
  }
  const page = await perfTime('feed.latestMessages', () => latestConvMessages(conv, line, PAGE_SIZE));
  if (!generation.current()) return [];
  mergePageIntoFeed(line, page);
  markFeedLoaded(line);
  if (!takeFreshFeed(line)) void revalidateFeed(line, !sdk.isGroup(conv));
  return feedCache.get(line) ?? [];
}

async function showCachedFeed(line: string, generation: FeedGeneration): Promise<boolean> {
  if (feedCache.get(line) !== undefined) return false;
  const cached = await cachedFeed(line).catch(recover('feed.cached', null));
  if (!generation.current() || !cached?.length || isFeedLoaded(line) || feedCache.get(line) !== undefined) return false;
  feedCache.showCached(line, cached);
  markFeedLoaded(line);
  perfLog('feed.cachedPage', { entries: cached.length });
  return true;
}

export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const generation = feedGeneration();
  const latest = trackFirstPageLoad(loadFirstPage(line, generation));
  const cached = showCachedFeed(line, generation).then((shown) => {
    if (!shown) return latest;
    void latest.catch(reported('feed.firstPage'));
    return feedCache.get(line) ?? [];
  });
  return Promise.race([latest, cached]);
}

export function prefetchFeed(line: string): void {
  void getQueryClient()
    .prefetchQuery({ queryKey: feedQueryKey(getAccountEpoch(), line), queryFn: () => loadFeedFirstPage(line), staleTime: 2_000 })
    .catch(ignored(undefined, 'optional'));
}

export async function loadFeedOlderPage(line: string, oldest: HistoryEntry): Promise<void> {
  mergePageIntoFeed(line, await olderConvMessages(line, Date.parse(oldest.ts), PAGE_SIZE), true);
}
