import type { HistoryEntry } from '@stage-labs/client/types';
import { isControlBody } from './xmtp.types';
import { feedCache, activeFeedLines } from './xmtp.state.core';
import { report } from './errorPolicy';
import { mergeFeedEntries } from './feedOrder.model';

export const PAGE_SIZE = 20;

export function mergeIntoFeed(line: string, entries: readonly HistoryEntry[]): number {
  const merged = mergeFeedEntries(feedCache.get(line) ?? [], entries.filter(e => !isControlBody(e.text)));
  if (merged.added > 0) feedCache.set(line, merged.entries);
  return merged.added;
}

export function throttledInboxSync(syncAll: () => Promise<boolean>): (maxAgeMs?: number) => Promise<void> {
  let inFlight: Promise<void> | null = null;
  let lastAt = 0;
  return async (maxAgeMs = 3_000): Promise<void> => {
    if (inFlight) return inFlight;
    if (Date.now() - lastAt < maxAgeMs) return;
    inFlight = (async () => {
      try {
        if (await syncAll()) lastAt = Date.now();
      } catch (err) {
        report('xmtp.inboxSync', err);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}

export function feedResync(
  syncInbox: () => Promise<void>,
  latestPage: (line: string) => Promise<HistoryEntry[] | null>,
): () => Promise<void> {
  return async (): Promise<void> => {
    await syncInbox();
    for (const line of activeFeedLines) {
      try {
        const page = await latestPage(line);
        if (page !== null) mergeIntoFeed(line, page);
      } catch (err) {
        report('xmtp.feedResync', err);
      }
    }
  };
}
