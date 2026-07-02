export interface ChannelListRow {
  convId: string;
  title: string;
  lastPreview: string;
  lastTs: number | null;
  unreadCount: number;
  markedUnread?: boolean;
  labels?: string[];
  peerAddress?: string | null;
  memberAddresses?: string[];
}

export interface ChannelListFilter {
  archived?: Set<string>;
  enabledLabels?: Set<string>;
  unreadOnly?: boolean;
  query?: string;
}

export function rowMatchesQuery(row: ChannelListRow, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return (
    row.title.toLowerCase().includes(normalizedQuery)
    || row.lastPreview.toLowerCase().includes(normalizedQuery)
    || (row.peerAddress?.toLowerCase().includes(normalizedQuery) ?? false)
    || (row.memberAddresses ?? []).some(a => a.toLowerCase().includes(normalizedQuery))
  );
}

export function filterChannelRows<T extends ChannelListRow>(
  rows: T[],
  filter: ChannelListFilter,
): T[] {
  let out = rows;
  const archived = filter.archived;
  if (archived && archived.size > 0) {
    out = out.filter(r => !archived.has(r.convId));
  }
  const enabledLabels = filter.enabledLabels;
  if (enabledLabels && enabledLabels.size > 0) {
    out = out.filter(r => (r.labels ?? []).some(l => enabledLabels.has(l.toLowerCase())));
  }
  if (filter.unreadOnly) {
    out = out.filter(r => r.unreadCount > 0 || r.markedUnread === true);
  }
  const q = filter.query?.trim().toLowerCase() ?? '';
  if (q) out = out.filter(r => rowMatchesQuery(r, q));
  return out;
}

export function sortChannelRows<T extends ChannelListRow>(
  rows: T[],
  pinned?: Set<string>,
): T[] {
  return [...rows].sort((a, b) => {
    const ap = pinned?.has(a.convId) === true ? 1 : 0;
    const bp = pinned?.has(b.convId) === true ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return (b.lastTs ?? 0) - (a.lastTs ?? 0);
  });
}

export function deriveBarLabels(rows: readonly { labels?: string[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    for (const label of r.labels ?? []) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
