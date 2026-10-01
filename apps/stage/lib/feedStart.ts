import { createValueStore } from './persistedStore';
import { feedStartOf, parseFeedStarts, withFeedStart, type FeedStart } from './feedStart.model';

const store = createValueStore<FeedStart[]>({
  key: 'feed.reachedStart',
  default: [],
  serialize: (starts) => JSON.stringify(starts),
  deserialize: parseFeedStarts,
});

store.loadAsync();

export function feedStartId(line: string): string | undefined {
  return feedStartOf(store.get(), line);
}

export function markFeedStart(line: string, firstId: string): void {
  if (feedStartId(line) !== firstId) store.set(withFeedStart(store.get(), line, firstId));
}

export function useFeedStartId(line: string | null): string | undefined {
  const starts = store.use();
  return line === null ? undefined : feedStartOf(starts, line);
}
