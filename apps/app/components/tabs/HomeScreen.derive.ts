/** @file Pure row-derivation helpers for HomeScreen: archive/label/unread filtering + pinned-first sort. */
import type { Row as RowT } from './HomeScreen.helpers';

/** Filter inputs that produce the displayed, sorted channel rows. */
export interface SortInputs {
  rows: RowT[] | null;
  archived: Set<string>;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: Set<string>;
}

/** Apply the archive, label (OR), and unread filters to the raw rows. */
function filterRows(i: SortInputs): RowT[] {
  // Archived convs are removed from the main list (shown only in Archived).
  const all = (i.rows ?? []).filter(r => !i.archived.has(r.convId));
  // Label filter (ANY/OR): empty enabled set → all; else keep rows with an enabled label.
  const byLabel = i.enabledLabels.size === 0
    ? all
    : all.filter(r => (r.labels ?? []).some(l => i.enabledLabels.has(l.toLowerCase())));
  // Unread chip: AND-narrow to conversations with unread messages.
  return i.unreadOnly ? byLabel.filter(r => r.unreadCount > 0 || r.markedUnread) : byLabel;
}

/** Filter + sort the rows for display: pinned float to the top, then by lastTs desc. */
export function deriveSortedRows(i: SortInputs): RowT[] {
  const list = filterRows(i);
  return [...list].sort((a, b) => {
    const ap = i.pinned.has(a.convId) ? 1 : 0;
    const bp = i.pinned.has(b.convId) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.lastTs ?? 0) - (a.lastTs ?? 0);
  });
}
