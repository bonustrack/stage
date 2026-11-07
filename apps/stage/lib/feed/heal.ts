import type { HistoryEntry } from '@stage-labs/client/types';
import { isShownInFeed } from '@stage-labs/client/xmtp/visibility';
import { convOfLine } from '../xmtp.find';
import { latestConvMessages } from '../xmtp.messages';
import { feedCache, feedGeneration } from './cache';
import { PAGE_SIZE, mergePageIntoFeed } from './merge';
import { refreshLatestPage } from './resync';
import { report } from '../errorPolicy';

export function feedLatest(line: string): HistoryEntry | undefined {
  return feedCache.get(line)?.find(isShownInFeed);
}

export function feedLatestNs(line: string): number {
  const ms = Date.parse(feedLatest(line)?.ts ?? '');
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

function logReconcileHeal(
  label: string,
  line: string,
  healedBy: string,
  before: HistoryEntry | undefined,
  after: HistoryEntry | undefined,
): void {
  console.log(
    label,
    JSON.stringify({
      line,
      feedLatestId: before?.id ?? null,
      feedLatestTs: before?.ts ?? null,
      storeLatestId: after?.id ?? null,
      storeLatestTs: after?.ts ?? null,
      healedBy,
    }),
  );
}

export async function reconcileOnOpen(line: string): Promise<void> {
  const generation = feedGeneration();
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    const [storeLatest] = await latestConvMessages(conv, line, 1);
    if (!storeLatest || !isShownInFeed(storeLatest)) return;
    const feed = feedLatest(line);
    if (feed?.id === storeLatest.id) return;
    const page = await latestConvMessages(conv, line, PAGE_SIZE);
    if (!generation.current()) return;
    mergePageIntoFeed(line, page);
    logReconcileHeal('[feed-reconcile] open-time heal', line, 'reconcileOnOpen', feed, storeLatest);
  } catch (err) {
    report('feed.reconcileOnOpen', err);
  }
}

export async function healArrivalGap(line: string): Promise<void> {
  try {
    const page = await refreshLatestPage(line);
    if (!page) return;
    const before = feedLatest(line);
    mergePageIntoFeed(line, page);
    const after = feedLatest(line);
    if (before?.id !== after?.id) logReconcileHeal('[feed-reconcile] arrival-gap heal', line, 'reconcileOnArrival', before, after);
  } catch (err) {
    report('feed.reconcileOnArrival', err);
  }
}
