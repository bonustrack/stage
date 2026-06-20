
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

function mergeNewestFirst(prev: HistoryEntry[], additions: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set(prev.map(e => e.id));
  const fresh = additions.filter(e => !isMetroControlBody(e.text) && !seen.has(e.id));
  return fresh.length === 0 ? prev : [...fresh, ...prev];
}

function applyPage(line: string, msgs: Parameters<typeof envelopeOfXmtpMessage>[0][]): void {
  const prev = feedCache.get(line) ?? [];
  const next = mergeNewestFirst(prev, msgs.map(m => envelopeOfXmtpMessage(m, line)));
  if (next !== prev) feedCache.set(line, next);
}

const bgSyncInFlight = new Map<string, Promise<void>>();

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
      await reconcileOnOpen(line);
    } catch { }
    finally { bgSyncInFlight.delete(line); }
  })();
  bgSyncInFlight.set(line, run);
  return run;
}

export async function loadFeedFirstPage(line: string): Promise<HistoryEntry[]> {
  const conv = await convOfLine(line);
  if (!conv) {
    await revalidateFeed(line);
    return feedCache.get(line) ?? [];
  }
  applyPage(line, await conv.messages({ limit: PAGE_SIZE }));
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

