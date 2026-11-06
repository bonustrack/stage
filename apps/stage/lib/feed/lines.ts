const activeLines = new Set<string>();
const feedLineHolds = new Map<string, number>();
const loadedFeedLines = new Set<string>();
let feedHoldEpoch = 0;

export function holdFeedLine(line: string): () => void {
  const epoch = feedHoldEpoch;
  feedLineHolds.set(line, (feedLineHolds.get(line) ?? 0) + 1);
  activeLines.add(line);
  let released = false;
  return () => {
    if (released || epoch !== feedHoldEpoch) return;
    released = true;
    const left = (feedLineHolds.get(line) ?? 1) - 1;
    if (left > 0) {
      feedLineHolds.set(line, left);
      return;
    }
    feedLineHolds.delete(line);
    activeLines.delete(line);
  };
}

export function isFeedLineActive(line: string): boolean {
  return activeLines.has(line);
}

export function hasOpenFeeds(): boolean {
  return activeLines.size > 0;
}

export function openFeedLines(): IterableIterator<string> {
  return activeLines.values();
}

export function markFeedLoaded(line: string): void {
  loadedFeedLines.add(line);
}

const FRESH_FEED_MS = 60_000;
const freshFeedLines = new Map<string, number>();

export function markFreshFeed(line: string): void {
  freshFeedLines.set(line, Date.now());
}

export function takeFreshFeed(line: string): boolean {
  const markedAt = freshFeedLines.get(line);
  freshFeedLines.delete(line);
  return markedAt !== undefined && Date.now() - markedAt < FRESH_FEED_MS;
}

export function isFeedLoaded(line: string): boolean {
  return loadedFeedLines.has(line);
}

export function resetFeedLines(): void {
  feedHoldEpoch += 1;
  feedLineHolds.clear();
  activeLines.clear();
  loadedFeedLines.clear();
  freshFeedLines.clear();
}
