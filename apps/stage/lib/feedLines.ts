export const activeFeedLines = new Set<string>();

const feedLineHolds = new Map<string, number>();
const loadedFeedLines = new Set<string>();
let feedHoldEpoch = 0;

export function holdFeedLine(line: string): () => void {
  const epoch = feedHoldEpoch;
  feedLineHolds.set(line, (feedLineHolds.get(line) ?? 0) + 1);
  activeFeedLines.add(line);
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
    activeFeedLines.delete(line);
  };
}

export function markFeedLoaded(line: string): void {
  loadedFeedLines.add(line);
}

export function isFeedLoaded(line: string): boolean {
  return loadedFeedLines.has(line);
}

export function resetFeedLines(): void {
  feedHoldEpoch += 1;
  feedLineHolds.clear();
  activeFeedLines.clear();
  loadedFeedLines.clear();
}
