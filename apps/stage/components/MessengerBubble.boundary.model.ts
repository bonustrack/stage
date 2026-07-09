import type { HistoryEntry } from '@stage-labs/client/types';

type FallbackEntry = Pick<HistoryEntry, 'text' | 'payload'>;

function contentTypeOf(entry: FallbackEntry): string | undefined {
  const ct = (entry.payload as { contentType?: unknown } | undefined)?.contentType;
  return typeof ct === 'string' && ct.trim() ? ct.trim() : undefined;
}

export function bubbleFallbackText(entry: FallbackEntry): string {
  try {
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (text) return text;
    const ct = contentTypeOf(entry);
    return ct ? `Unsupported message (${ct})` : 'Unsupported message';
  } catch {
    return 'Unsupported message';
  }
}

export function bubbleFallbackShape(entry: FallbackEntry): {
  contentType: string | undefined; hasText: boolean; textLength: number;
} {
  const hasText = typeof entry.text === 'string' && entry.text.trim().length > 0;
  return {
    contentType: contentTypeOf(entry),
    hasText,
    textLength: typeof entry.text === 'string' ? entry.text.length : 0,
  };
}
