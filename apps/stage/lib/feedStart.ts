import { createValueStore } from './persistedStore';
import { parseFeedStarts, withFeedStart } from './feedStart.model';

const store = createValueStore<string[]>({
  key: 'feed.reachedStart',
  default: [],
  serialize: (lines) => JSON.stringify(lines),
  deserialize: parseFeedStarts,
});

store.loadAsync();

export function feedReachedStart(line: string): boolean {
  return store.get().includes(line);
}

export function markFeedStart(line: string): void {
  if (!feedReachedStart(line)) store.set(withFeedStart(store.get(), line));
}

export function useFeedReachedStart(line: string | null): boolean {
  const lines = store.use();
  return line !== null && lines.includes(line);
}
