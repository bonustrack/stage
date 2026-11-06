import type { HistoryEntry } from '@stage-labs/client/types';
import { isShownInFeed } from '@stage-labs/client/xmtp/visibility';
import { feedCache, feedGeneration } from './cache';
import { hasOpenFeeds, isFeedLineActive } from './lines';
import { mergeIntoFeed } from './merge';
import { resyncActiveFeeds } from './resync';
import { feedLatest, feedLatestNs, healArrivalGap } from './heal';

async function reconcileOnArrival(line: string, prevLatestNs: number, arrivingNs: number, arrivingId: string): Promise<void> {
  if (!isFeedLineActive(line)) return;
  const latestNow = feedLatest(line);
  if (latestNow?.id === arrivingId && arrivingNs >= prevLatestNs) return;
  await healArrivalGap(line);
}

export function onArrival(line: string, entry: HistoryEntry, sentNs: number): void {
  if (!isShownInFeed(entry)) return;
  const prevLatestNs = isFeedLineActive(line) ? feedLatestNs(line) : 0;
  mergeIntoFeed(line, [entry]);
  if (isFeedLineActive(line)) {
    void reconcileOnArrival(line, prevLatestNs, sentNs, entry.id);
  }
  if (hasOpenFeeds() && !isFeedLineActive(line)) void resyncActiveFeeds();
}

export function onUnknownArrival(): void {
  if (hasOpenFeeds()) void resyncActiveFeeds();
}

export async function onDeletion(
  line: string,
  messageId: string,
  deletedEntry: () => Promise<HistoryEntry | null>,
  stillCurrent: () => boolean,
): Promise<void> {
  if (!feedCache.get(line)?.some((e) => e.id === messageId)) return;
  const generation = feedGeneration();
  const entry = await deletedEntry();
  if (!stillCurrent() || !generation.current()) return;
  if (entry) mergeIntoFeed(line, [entry]);
  else if (isFeedLineActive(line)) await resyncActiveFeeds();
}

export function onStreamClosed(): void {
  void resyncActiveFeeds();
}
