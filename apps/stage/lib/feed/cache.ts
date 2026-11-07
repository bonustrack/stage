import type { HistoryEntry } from '@stage-labs/client/types';
import { makeListeners } from '../storeCore';
import { resetFeedLines } from './lines';

let generation = 0;
const feedSlices = new Map<string, HistoryEntry[]>();
const cachedFeedIds = new Map<string, ReadonlySet<string>>();
const feedChanges = makeListeners<{ line: string; slice: HistoryEntry[] | undefined }>();

export interface FeedGeneration {
  readonly id: number;
  current(): boolean;
}

export function feedGeneration(): FeedGeneration {
  const id = generation;
  return { id, current: () => id === generation };
}

function setFeedSlice(line: string, slice: HistoryEntry[]): void {
  feedSlices.set(line, slice);
  feedChanges.notify({ line, slice });
}

export const feedCache = {
  get: (line: string): HistoryEntry[] | undefined => feedSlices.get(line),
  set: setFeedSlice,
  showCached(line: string, slice: HistoryEntry[]): void {
    cachedFeedIds.set(line, new Set(slice.map((e) => e.id)));
    setFeedSlice(line, slice);
  },
  cachedIds: (line: string): ReadonlySet<string> | undefined => cachedFeedIds.get(line),
  settleCached(line: string): void {
    cachedFeedIds.delete(line);
  },
  subscribeAll: feedChanges.subscribe,
};

export function resetFeed(): void {
  resetFeedLines();
  generation += 1;
  const lines = [...feedSlices.keys()];
  feedSlices.clear();
  cachedFeedIds.clear();
  for (const line of lines) feedChanges.notify({ line, slice: undefined });
}
