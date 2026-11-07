import { uniqueKeys } from '../collections';
import type { ChannelRow } from './channelsCache';

export type ChannelListRow = Pick<ChannelRow, 'convId' | 'title' | 'lastPreview' | 'lastTs' | 'unreadCount'> &
  Partial<Pick<ChannelRow, 'markedUnread' | 'labels' | 'peerAddress'>> & { memberAddresses?: string[] };

export interface ChannelListFilter {
  enabledLabels?: Set<string>;
  unreadOnly?: boolean;
  query?: string;
}

export function rowMatchesQuery(row: ChannelListRow, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return (
    row.title.toLowerCase().includes(normalizedQuery) ||
    row.lastPreview.toLowerCase().includes(normalizedQuery) ||
    (row.peerAddress?.toLowerCase().includes(normalizedQuery) ?? false) ||
    (row.memberAddresses ?? []).some((a) => a.toLowerCase().includes(normalizedQuery))
  );
}

export function filterChannelRows<T extends ChannelListRow>(rows: T[], filter: ChannelListFilter): T[] {
  let out = rows;
  const enabledLabels = filter.enabledLabels;
  if (enabledLabels && enabledLabels.size > 0) out = out.filter((r) => (r.labels ?? []).some((l) => enabledLabels.has(l.toLowerCase())));
  if (filter.unreadOnly) out = out.filter((r) => r.unreadCount > 0 || r.markedUnread === true);
  const q = filter.query?.trim().toLowerCase() ?? '';
  if (q) out = out.filter((r) => rowMatchesQuery(r, q));
  return out;
}

export function deriveBarLabels(rows: readonly { labels?: string[] }[]): string[] {
  return uniqueKeys(rows.flatMap((r) => r.labels ?? [])).sort((a, b) => a.localeCompare(b));
}
