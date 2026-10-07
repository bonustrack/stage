import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { savedFirst } from '@stage-labs/client/xmtp/pinOrder';
import { compareNames } from '../../lib/format';
import { NO_GROUP_TITLES, bucketRows, type Bucket, type NameOf } from './groupBy.model';
import type { Row } from './model';

export interface ChannelGroupHeader {
  key: string;
  title: string;
  count: number;
  unread: number;
  collapsed: boolean;
}

interface GroupHeaderItem {
  convId: string;
  header: ChannelGroupHeader;
}

export type HomeListItem = (Row & { listKey?: string }) | GroupHeaderItem;

const DM_GROUP = { key: 'dm', title: 'Direct messages' };
export const NO_GROUP_KEY = 'none';
const HEADER_ID_PREFIX = 'group:';

interface GroupRow {
  convId: string;
  peerAddress: string | null;
  labels?: string[];
  category?: string | null;
  assigned?: string[];
  unreadCount: number;
  markedUnread: boolean;
}

export function isGroupHeader(item: HomeListItem): item is GroupHeaderItem {
  return (item as GroupHeaderItem).header !== undefined;
}

export function rowsOf(items: readonly HomeListItem[]): Row[] {
  return items.filter((item): item is Row => !isGroupHeader(item));
}

export const listKeyOf = (item: HomeListItem): string => (isGroupHeader(item) ? item.convId : item.listKey ?? item.convId);

export const sectionKeyOf = (by: GroupKey, value: string): string => `${by}:${value.toLowerCase()}`;

function orderedBuckets<R extends GroupRow>(
  rows: readonly R[], by: GroupKey, nameOf: NameOf, order: readonly string[],
): Bucket<R>[] {
  const dm = rows.filter(row => row.peerAddress !== null);
  const { buckets, none } = bucketRows(rows.filter(row => row.peerAddress === null), by, nameOf, value => sectionKeyOf(by, value));
  const grouped = by === 'category'
    ? savedFirst(buckets, order.map(key => key.toLowerCase()), b => b.key, (a, b) => compareNames(a.key, b.key))
    : buckets.sort((a, b) => compareNames(a.title, b.title));
  return [
    ...(dm.length === 0 ? [] : [{ ...DM_GROUP, rows: dm }]),
    ...grouped,
    ...(none.length === 0 ? [] : [{ key: NO_GROUP_KEY, title: NO_GROUP_TITLES[by], rows: none }]),
  ];
}

function unreadOf(rows: readonly GroupRow[]): number {
  return rows.filter(r => r.unreadCount > 0 || r.markedUnread).length;
}

function uniqueListItems(bucket: Bucket<Row>, seen: Set<string>): HomeListItem[] {
  return bucket.rows.map((row) => {
    if (!seen.has(row.convId)) { seen.add(row.convId); return row; }
    return { ...row, listKey: `${bucket.key}/${row.convId}` };
  });
}

export function groupRows(
  rows: readonly Row[], by: GroupKey, collapsed: ReadonlySet<string>, expandAll: boolean, nameOf: NameOf,
  order: readonly string[] = [],
): HomeListItem[] {
  const seen = new Set<string>();
  return orderedBuckets(rows, by, nameOf, order).flatMap((bucket): HomeListItem[] => {
    const folded = collapsed.has(bucket.key) && !expandAll;
    const header: ChannelGroupHeader = {
      key: bucket.key, title: bucket.title, count: bucket.rows.length, unread: unreadOf(bucket.rows), collapsed: folded,
    };
    return [{ convId: HEADER_ID_PREFIX + bucket.key, header }, ...(folded ? [] : uniqueListItems(bucket, seen))];
  });
}
