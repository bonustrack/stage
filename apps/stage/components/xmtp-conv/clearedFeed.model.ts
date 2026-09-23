import type { HistoryEntry } from '@stage-labs/client/types';

function sentAtMs(entry: HistoryEntry): number {
  return Date.parse(entry.ts);
}

export function entriesAfterClear(events: HistoryEntry[], clearedAtMs: number | undefined): HistoryEntry[] {
  if (clearedAtMs === undefined) return events;
  return events.filter((e) => {
    const at = sentAtMs(e);
    return Number.isNaN(at) || at > clearedAtMs;
  });
}

export function feedReachedClear(events: HistoryEntry[], clearedAtMs: number | undefined): boolean {
  return clearedAtMs !== undefined && events.some((e) => sentAtMs(e) <= clearedAtMs);
}
