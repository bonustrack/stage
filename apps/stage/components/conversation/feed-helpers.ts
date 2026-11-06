import { humanizeMentions, attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from '@stage-labs/client/types';
import { attachmentsOf } from '@stage-labs/client/xmtp/entryPayload';

export function previewOf(e: HistoryEntry): string {
  const text = e.text ? humanizeMentions(e.text).slice(0, 80) : '';
  if (text) return text;
  const a = attachmentsOf(e)[0];
  return attachmentEmojiPreview(a?.mime, a?.name);
}

export function entriesAfterClear(events: HistoryEntry[], clearedAtMs: number | undefined): HistoryEntry[] {
  if (clearedAtMs === undefined) return events;
  return events.filter((e) => {
    const at = Date.parse(e.ts);
    return Number.isNaN(at) || at > clearedAtMs;
  });
}

export function feedReachedClear(events: HistoryEntry[], clearedAtMs: number | undefined): boolean {
  return clearedAtMs !== undefined && events.some((e) => Date.parse(e.ts) <= clearedAtMs);
}

export function countFromOthers(events: readonly HistoryEntry[], myUri: string): number {
  return events.reduce((n, e) => (e.from === myUri ? n : n + 1), 0);
}
