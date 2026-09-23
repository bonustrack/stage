
import { getQueryClient } from '../../lib/queryClient';
import { getAccountEpoch } from '../../lib/accountEpoch';
import type { HistoryEntry } from '@stage-labs/client/types';
import { isControlBody } from '../../lib/xmtp.types';
import { convOfLine } from '../../lib/xmtp.client';
import { latestConvMessages, olderConvMessages } from '../../lib/xmtp.messages';
import { prependToFeed, refreshLatestPage } from '../../lib/xmtp.resync';
import { feedCache } from '../../lib/xmtp.state';
import { perfLog, perfTime } from '../../lib/perf';
import { syncInboxOnce, PAGE_SIZE } from '../../lib/xmtp.stream';
import { messagingKeys } from './queries';
import { reconcileOnOpen } from './feedReconcile';

function mirrorSlice(line: string, slice: HistoryEntry[] | undefined): void {
  const key = messagingKeys.messages(getAccountEpoch(), line);
  getQueryClient().setQueryData<HistoryEntry[]>(key, slice ?? []);
}

let bridgeStarted = false;
export function ensureFeedQueryBridge(): void {
  if (bridgeStarted) return;
  bridgeStarted = true;
  feedCache.subscribeAll((line, slice) => { mirrorSlice(line, slice); });
}

const bgSyncInFlight = new Map<string, Promise<void>>();

function revalidateFeed(line: string): Promise<void> {
  const existing = bgSyncInFlight.get(line);
  if (existing) return existing;
  const run = (async (): Promise<void> => {
    try {
      await syncInboxOnce(0);
      const page = await refreshLatestPage(line);
      if (!page) return;
      prependToFeed(line, page);
      await reconcileOnOpen(line);
    } catch { }
    finally { bgSyncInFlight.delete(line); }
  })();
  bgSyncInFlight.set(line, run);
  return run;
}

export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const conv = await perfTime('feed.convOfLine', () => convOfLine(line));
  if (!conv) {
    perfLog('feed.coldPath: conversation not local, awaiting network');
    await perfTime('feed.revalidate', () => revalidateFeed(line));
    return feedCache.get(line) ?? [];
  }
  prependToFeed(line, await perfTime('feed.latestMessages', () => latestConvMessages(conv, line, PAGE_SIZE)));
  void revalidateFeed(line);
  return feedCache.get(line) ?? [];
}

export function prefetchFeed(line: string): void {
  void getQueryClient()
    .prefetchQuery({
      queryKey: messagingKeys.messages(getAccountEpoch(), line),
      queryFn: () => loadFeedFirstPage(line),
      staleTime: 2_000,
    })
    .catch(() => undefined);
}

export async function loadFeedOlderPage(line: string, oldest: HistoryEntry): Promise<boolean> {
  const beforeTsMs = new Date(oldest.ts).getTime();
  const mapped = (await olderConvMessages(line, beforeTsMs, PAGE_SIZE))
    .filter(e => !isControlBody(e.text));
  const prev = feedCache.get(line) ?? [];
  const seen = new Set(prev.map(e => e.id));
  const additions = mapped.filter(e => !seen.has(e.id));
  if (additions.length > 0) feedCache.set(line, [...prev, ...additions]);
  return additions.length >= PAGE_SIZE;
}

