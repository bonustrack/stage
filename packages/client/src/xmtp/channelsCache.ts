
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

export function applyRead<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  nowNs: number,
): R[] | null {
  const idx = findRowIndex(rows, convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  const next = [...rows];
  next[idx] = { ...cur, unreadCount: 0, lastReadNs: nowNs, markedUnread: false };
  return next;
}

export function applyUnread<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
): R[] | null {
  const idx = findRowIndex(rows, convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  const next = [...rows];
  next[idx] = { ...cur, unreadCount: Math.max(1, cur.unreadCount), lastReadNs: 0, markedUnread: true };
  return next;
}

export function applyConsent<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  markedUnread: boolean,
): R[] | null {
  const idx = findRowIndex(rows, convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  if (cur.markedUnread === markedUnread) return null;
  const next = [...rows];
  next[idx] = markedUnread
    ? { ...cur, markedUnread: true, unreadCount: Math.max(1, cur.unreadCount) }
    : { ...cur, markedUnread: false, unreadCount: 0 };
  return next;
}

export function applySentPatch<R extends CachedChannelRow>(
  rows: readonly R[],
  convId: string,
  preview: string,
  nowMs: number,
): R[] | null {
  const idx = findRowIndex(rows, convId);
  const cur = idx === -1 ? undefined : rows[idx];
  if (cur === undefined) return null;
  const updated = {
    ...cur,
    lastTs: nowMs,
    lastPreview: preview.slice(0, 80),
    lastFromSelf: true,
    unreadCount: 0,
    markedUnread: false,
  } as R;
  return [updated, ...rows.slice(0, idx), ...rows.slice(idx + 1)];
}
