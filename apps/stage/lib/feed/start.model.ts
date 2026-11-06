export const FEED_START_LIMIT = 500;

export type FeedStart = readonly [line: string, firstId: string];

export function withFeedStart(starts: readonly FeedStart[], line: string, firstId: string): FeedStart[] {
  return [...starts.filter(([known]) => known !== line), [line, firstId] as const].slice(-FEED_START_LIMIT);
}

export function feedStartOf(starts: readonly FeedStart[], line: string): string | undefined {
  return starts.find(([known]) => known === line)?.[1];
}

export function isAtFeedStart(oldestId: string | undefined, firstId: string | undefined): boolean {
  return firstId !== undefined && (oldestId ?? '') === firstId;
}

function isFeedStart(value: unknown): value is FeedStart {
  return Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'string');
}

export function parseFeedStarts(raw: string): FeedStart[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFeedStart) : undefined;
  } catch {
    return undefined;
  }
}
