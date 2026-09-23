
import type { HistoryEntry } from '@stage-labs/client/types';
import { isControlBody } from '../../lib/xmtp.types';
import { convOfLine } from '../../lib/xmtp.client';
import { latestConvMessages } from '../../lib/xmtp.messages';
import { feedCache, activeFeedLines } from '../../lib/xmtp.state.core';
import { PAGE_SIZE, prependToFeed, refreshLatestPage } from '../../lib/xmtp.resync';

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

export async function reconcileOnOpen(line: string): Promise<void> {
  try {
    const conv = await convOfLine(line);
    if (!conv) return;
    const [storeLatest] = await latestConvMessages(conv, line, 1);
    if (!storeLatest) return;
    if (isControlBody(storeLatest.text)) return;
    const feed = feedLatest(line);
    if (feed?.id === storeLatest.id) return;
    prependToFeed(line, await latestConvMessages(conv, line, PAGE_SIZE));
    logReconcileHeal('[feed-reconcile] open-time heal', line, 'reconcileOnOpen', feed, storeLatest);
  } catch { }
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
    prependToFeed(line, page);
    const after = feedLatest(line);
    if (before?.id !== after?.id) {
      logReconcileHeal(
        '[feed-reconcile] arrival-gap heal', line, 'reconcileOnArrival',
        before, { id: after?.id ?? null, ts: after?.ts ?? null },
      );
    }
  } catch { }
}

export function feedLatestNs(line: string): number {
  const e = feedLatest(line);
  return e ? entryNs(e) : 0;
}
