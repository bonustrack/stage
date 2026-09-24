
import { ROW_PREVIEW_MAX_CHARS } from './summarizeRow';

export interface CachedChannelRow {
  convId: string;
  unreadCount: number;
  lastReadNs: number;
  markedUnread?: boolean;
  [key: string]: unknown;
}

function findRowIndex(
  rows: readonly CachedChannelRow[],
  convId: string,
): number {
  return rows.findIndex(r => r.convId === convId);
}

function patchRow<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  patch: (cur: R) => R,
  moveToTop = false,
): R[] | null {
  const idx = findRowIndex(rows, convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  const updated = patch(cur);
  if (moveToTop) return [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)];
  const next = [...rows];
  next[idx] = updated;
  return next;
}

export function applyRead<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  nowNs: number,
): R[] | null {
  return patchRow(rows, convId, (cur) => ({ ...cur, unreadCount: 0, lastReadNs: nowNs, markedUnread: false }));
}

export function applyUnread<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
): R[] | null {
  return patchRow(rows, convId, (cur) => ({ ...cur, markedUnread: true }));
}

export function applySentPatch<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  preview: string,
  nowMs: number,
): R[] | null {
  return patchRow(rows, convId, (cur) => ({
    ...cur,
    lastTs: nowMs,
    lastPreview: preview.slice(0, ROW_PREVIEW_MAX_CHARS),
    lastFromSelf: true,
    unreadCount: 0,
    markedUnread: false,
  }), true);
}

export interface InboundRowUpdate {
  convId: string | null;
  senderInboxId?: string;
  sentNs: number;
  lastTs: number;
  lastPreview: string;
  countsAsUnread?: boolean;
}

export interface InboundApplyResult<R> {
  next: R[];
  current: R;
  wasUnread: boolean;
}

export function applyInbound<R extends CachedChannelRow & { selfInboxId: string }>(
  rows: readonly R[],
  update: InboundRowUpdate,
  patch?: (current: R) => Partial<R>,
): InboundApplyResult<R> | null {
  const idx = update.convId === null ? -1 : findRowIndex(rows, update.convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  const wasUnread = update.countsAsUnread !== false
    && update.sentNs > cur.lastReadNs && update.senderInboxId !== cur.selfInboxId;
  const unreadCount = wasUnread ? cur.unreadCount + 1 : cur.unreadCount;
  const updated: R = {
    ...cur,
    lastTs: update.lastTs,
    lastPreview: update.lastPreview,
    unreadCount,
    ...(patch ? patch(cur) : {}),
  };
  if (wasUnread) updated.markedUnread = false;
  return {
    next: [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)],
    current: cur,
    wasUnread,
  };
}
