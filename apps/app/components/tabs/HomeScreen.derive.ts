import type { Row as RowT } from './HomeScreen.helpers';

export interface SortInputs {
  rows: RowT[] | null;
  archived: Set<string>;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: Set<string>;
}

function filterRows(i: SortInputs): RowT[] {
  const all = (i.rows ?? []).filter(r => !i.archived.has(r.convId));
  const byLabel = i.enabledLabels.size === 0
    ? all
    : all.filter(r => (r.labels ?? []).some(l => i.enabledLabels.has(l.toLowerCase())));
  return i.unreadOnly ? byLabel.filter(r => r.unreadCount > 0 || r.markedUnread) : byLabel;
}

export function deriveSortedRows(i: SortInputs): RowT[] {
  const list = filterRows(i);
  return [...list].sort((a, b) => {
    const ap = i.pinned.has(a.convId) ? 1 : 0;
    const bp = i.pinned.has(b.convId) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.lastTs ?? 0) - (a.lastTs ?? 0);
  });
}
