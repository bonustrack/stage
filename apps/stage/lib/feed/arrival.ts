import type { HistoryEntry } from '@stage-labs/client/types';
import { isShownInFeed } from '@stage-labs/client/xmtp/visibility';
import { feedCache, feedGeneration } from './cache';
import { hasOpenFeeds, isFeedLineActive } from './lines';
import { mergeIntoFeed } from './merge';
import { resyncActiveFeeds } from './resync';
import { feedLatest, feedLatestNs, healArrivalGap } from './heal';

export function onArrival(line: string, entry: HistoryEntry, sentNs: number): void {
  if (!isShownInFeed(entry)) return;
  if (!isFeedLineActive(line)) {
    mergeIntoFeed(line, [entry]);
    if (hasOpenFeeds()) void resyncActiveFeeds();
    return;
  }
  const prevLatestNs = feedLatestNs(line);
  mergeIntoFeed(line, [entry]);
  if (feedLatest(line)?.id !== entry.id || sentNs < prevLatestNs) void healArrivalGap(line);
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
