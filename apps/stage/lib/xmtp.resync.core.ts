import type { HistoryEntry } from '@stage-labs/client/types';
import { isControlBody } from './xmtp.types';
import { feedCache, activeFeedLines } from './xmtp.state.core';

export const PAGE_SIZE = 20;

export function pushToFeedSlice(line: string, env: HistoryEntry): void {
  const prev = feedCache.get(line) ?? [];
  if (prev.some(e => e.id === env.id)) return;
  feedCache.set(line, [env, ...prev]);
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
      } catch { }
      finally { inFlight = null; }
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
        if (page === null) continue;
        for (const env of page.reverse()) {
          if (!isControlBody(env.text)) pushToFeedSlice(line, env);
        }
      } catch { }
    }
  };
}
