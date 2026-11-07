import { filterChannelRows, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { isRowCleared, type ClearableRow, type ClearedChats } from '@stage-labs/client/xmtp/sync/clear';
import type { HomeSort } from '@stage-labs/client/xmtp/sync/homeView';
import { sortHomeRows } from './sort.model';
import { isUnreadRow, type UnreadRow } from '../chatRow/chatRow.model';

type ListingRow = ChannelListRow & ClearableRow;

interface ListingChips<R extends ListingRow> {
  rows: readonly R[] | null;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
}

interface ListingVisibility<R extends ListingRow> {
  matches: (row: R) => boolean;
  cleared: ClearedChats;
}

export type ListingFilter<R extends ListingRow> = ListingChips<R> & ListingVisibility<R>;

export interface ListingOrder<R extends ListingRow> extends ListingChips<R> {
  pinned: readonly string[];
  sort?: HomeSort;
  statusOrder?: readonly string[];
}

function chipped<R extends ListingRow>(c: ListingChips<R>): R[] {
  return filterChannelRows([...(c.rows ?? [])], { enabledLabels: c.enabledLabels, unreadOnly: c.unreadOnly });
}

export function sortedListing<R extends ListingRow>(o: ListingOrder<R>): R[] {
  return sortHomeRows(chipped(o), o.pinned, o.sort, o.statusOrder);
}

function listedRows<R extends ListingRow>(rows: readonly R[], v: ListingVisibility<R>): R[] {
  return rows.filter((row) => v.matches(row) && !isRowCleared(v.cleared, row));
}

export function homeListing<R extends ListingRow>(i: ListingOrder<R> & ListingVisibility<R>): R[] {
  return listedRows(sortedListing(i), i);
}

export function unreadRowCount(rows: readonly UnreadRow[]): number {
  return rows.filter(isUnreadRow).length;
}

export function listedUnreadCount<R extends ListingRow>(f: ListingFilter<R>): number {
  return unreadRowCount(listedRows(chipped(f), f));
}
