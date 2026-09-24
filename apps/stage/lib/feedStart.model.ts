export const FEED_START_LIMIT = 500;

export function withFeedStart(lines: readonly string[], line: string, limit = FEED_START_LIMIT): string[] {
  if (lines.includes(line)) return [...lines];
  return [...lines, line].slice(-limit);
}

export function parseFeedStarts(raw: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : undefined;
  } catch {
    return undefined;
  }
}
