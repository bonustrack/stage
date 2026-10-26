import { humanizeMentions, attachmentEmojiPreview } from '@stage-labs/client/xmtp/humanize';
import type { HistoryEntry } from '@stage-labs/client/types';

export function hasAttachments(e: HistoryEntry): boolean {
  return (((e.payload as { attachments?: unknown[] } | undefined)?.attachments?.length) ?? 0) > 0;
}

export interface FeedScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

export function feedDistanceFromNewest(m: FeedScrollMetrics, upright: boolean): number {
  if (!upright) return Math.max(0, m.offset);
  return Math.max(0, m.contentHeight - m.viewportHeight - m.offset);
}

interface FeedPositionHold {
  minIndexForVisible: number;
  autoscrollToTopThreshold?: number;
}

export function feedPositionHold(
  upright: boolean, awayFromNewest: boolean, followWithinPx: number,
): FeedPositionHold | undefined {
  if (upright) return { minIndexForVisible: 0 };
  return awayFromNewest ? { minIndexForVisible: 0, autoscrollToTopThreshold: followWithinPx } : undefined;
}

export function uprightScrollOffset(
  distanceFromNewest: number, contentHeight: number, viewportHeight: number,
): number {
  return Math.max(0, contentHeight - viewportHeight - distanceFromNewest);
}

export function shouldPageOlder(m: FeedScrollMetrics, positioned: boolean): boolean {
  if (!positioned) return false;
  if (m.contentHeight <= m.viewportHeight) return true;
  return m.offset <= m.viewportHeight / 2;
}

export const FEED_MIN_BATCH = 12;
export const FEED_MAX_FIRST_PAINT = 60;

export function uprightFirstBatch(rowCount: number): number {
  return Math.min(Math.max(rowCount, FEED_MIN_BATCH), FEED_MAX_FIRST_PAINT);
}

export function planUprightRestore(args: {
  loaded: boolean; restoredSaved: boolean; savedDistance: number | undefined;
  userDragged: boolean; atNewest: boolean;
}): 'saved' | 'newest' | 'skip' {
  const { loaded, restoredSaved, savedDistance, userDragged, atNewest } = args;
  if (!loaded) return 'skip';
  if (!restoredSaved && savedDistance != null && savedDistance > 0) return 'saved';
  if (atNewest) return 'newest';
  return userDragged || restoredSaved ? 'skip' : 'newest';
}

export function isReaction(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string } | undefined;
  return Boolean(p?.reactTo);
}

export function previewOf(e: HistoryEntry): string {
  const text = e.text ? humanizeMentions(e.text).slice(0, 80) : '';
  if (text) return text;
  const a = (e.payload as { attachments?: { mime?: string; name?: string }[] } | undefined)?.attachments?.[0];
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
